"""Notion migration source implementation.

Migrates Notion pages, databases, and blocks into the Lurk data model.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

import httpx

from ..models import (
    ArtifactType,
    ContentClassification,
    MigrationItem,
    MigrationSource,
)
from .base import BaseMigrationSource, ExtractionResult, MappedItem

logger = logging.getLogger(__name__)

_NOTION_API_BASE = "https://api.notion.com/v1"
_NOTION_VERSION = "2022-06-28"


class NotionMigrationSource(BaseMigrationSource):
    """Migrates pages, databases, and blocks from Notion.

    Scope options:
      - page_ids: list[str] -- specific pages to migrate
      - database_ids: list[str] -- specific databases to migrate
      - root_page_id: str -- root page, migrate its entire subtree
      - include_databases: bool -- include database contents (default True)
      - include_child_pages: bool -- recurse into child pages (default True)
    """

    def __init__(self, credentials_ref: str, options: dict[str, Any] | None = None):
        super().__init__(credentials_ref, options)
        self._token: str | None = None
        self._client: httpx.AsyncClient | None = None

    @property
    def source_type(self) -> MigrationSource:
        return MigrationSource.NOTION

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def authenticate(self) -> bool:
        """Authenticate with Notion using an integration token."""
        self._token = self.credentials_ref  # placeholder
        self._client = httpx.AsyncClient(
            base_url=_NOTION_API_BASE,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Notion-Version": _NOTION_VERSION,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        resp = await self._client.get("users/me")
        if resp.status_code != 200:
            raise ConnectionError(f"Notion auth failed: {resp.status_code}")

        data = resp.json()
        logger.info("Notion authenticated as %s", data.get("name", "unknown"))
        self._authenticated = True
        return True

    # ------------------------------------------------------------------
    # Extraction
    # ------------------------------------------------------------------

    async def extract_items(
        self,
        scope: dict[str, Any],
    ) -> AsyncIterator[ExtractionResult]:
        """Extract pages and databases from Notion."""
        assert self._client is not None, "Must authenticate before extraction"

        page_ids: list[str] | None = scope.get("page_ids")
        database_ids: list[str] | None = scope.get("database_ids")
        root_page_id: str | None = scope.get("root_page_id")
        include_databases: bool = scope.get("include_databases", True)
        include_child_pages: bool = scope.get("include_child_pages", True)

        # Explicit pages
        if page_ids:
            for page_id in page_ids:
                result = await self._extract_page(page_id, include_child_pages)
                if result:
                    yield result

        # Explicit databases
        if database_ids and include_databases:
            for db_id in database_ids:
                async for item in self._extract_database(db_id):
                    yield item

        # Root page subtree
        if root_page_id:
            async for item in self._extract_page_tree(
                root_page_id,
                include_databases=include_databases,
                include_child_pages=include_child_pages,
            ):
                yield item

        # If no scope specified, search all accessible pages
        if not page_ids and not database_ids and not root_page_id:
            async for item in self._search_all(include_databases):
                yield item

    async def _extract_page(
        self,
        page_id: str,
        include_children: bool = True,
    ) -> ExtractionResult | None:
        """Extract a single Notion page and its block content."""
        assert self._client is not None

        resp = await self._client.get(f"pages/{page_id}")
        if resp.status_code != 200:
            logger.warning("Failed to fetch page %s: %s", page_id, resp.status_code)
            return None

        page_data = resp.json()
        title = self._extract_title(page_data)

        # Fetch blocks (the actual content)
        content = await self._fetch_blocks_as_text(page_id)

        parent_info = page_data.get("parent", {})
        parent_type = parent_info.get("type", "")
        parent_id = parent_info.get(parent_type, "")

        return ExtractionResult(
            source_id=f"notion:page:{page_id}",
            source_type="page",
            title=title,
            content=content,
            size_bytes=len(content.encode("utf-8")),
            metadata={
                "page_id": page_id,
                "parent_type": parent_type,
                "parent_id": parent_id,
                "created_time": page_data.get("created_time"),
                "last_edited_time": page_data.get("last_edited_time"),
                "created_by": page_data.get("created_by", {}).get("id"),
                "last_edited_by": page_data.get("last_edited_by", {}).get("id"),
                "url": page_data.get("url"),
                "archived": page_data.get("archived", False),
            },
            raw=page_data,
        )

    async def _extract_database(
        self, database_id: str
    ) -> AsyncIterator[ExtractionResult]:
        """Extract a Notion database and all its entries."""
        assert self._client is not None

        # Database metadata
        resp = await self._client.get(f"databases/{database_id}")
        if resp.status_code != 200:
            logger.warning(
                "Failed to fetch database %s: %s", database_id, resp.status_code
            )
            return

        db_data = resp.json()
        db_title = self._extract_title(db_data)

        # Extract database schema as content
        properties = db_data.get("properties", {})
        schema_lines = [f"Database: {db_title}", "Properties:"]
        for prop_name, prop_info in properties.items():
            schema_lines.append(f"  - {prop_name}: {prop_info.get('type', 'unknown')}")
        schema_content = "\n".join(schema_lines)

        yield ExtractionResult(
            source_id=f"notion:db:{database_id}",
            source_type="database",
            title=db_title,
            content=schema_content,
            size_bytes=len(schema_content.encode("utf-8")),
            metadata={
                "database_id": database_id,
                "property_count": len(properties),
                "url": db_data.get("url"),
            },
            raw=db_data,
        )

        # Query all entries
        has_more = True
        start_cursor: str | None = None

        while has_more:
            body: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                body["start_cursor"] = start_cursor

            resp = await self._client.post(
                f"databases/{database_id}/query", json=body
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            for entry in data.get("results", []):
                entry_content = self._entry_properties_to_text(entry)
                entry_id = entry["id"]
                yield ExtractionResult(
                    source_id=f"notion:entry:{entry_id}",
                    source_type="page",
                    title=self._extract_title(entry),
                    content=entry_content,
                    size_bytes=len(entry_content.encode("utf-8")),
                    metadata={
                        "page_id": entry_id,
                        "database_id": database_id,
                        "created_time": entry.get("created_time"),
                        "last_edited_time": entry.get("last_edited_time"),
                    },
                    raw=entry,
                )

            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

    async def _extract_page_tree(
        self,
        page_id: str,
        *,
        include_databases: bool = True,
        include_child_pages: bool = True,
    ) -> AsyncIterator[ExtractionResult]:
        """Recursively extract a page and all its child pages/databases."""
        result = await self._extract_page(page_id, include_children=True)
        if result:
            yield result

        if not include_child_pages:
            return

        # Get child blocks to find child pages and databases
        assert self._client is not None
        children = await self._get_child_blocks(page_id)

        for block in children:
            block_type = block.get("type", "")
            if block_type == "child_page":
                child_id = block["id"]
                async for item in self._extract_page_tree(
                    child_id,
                    include_databases=include_databases,
                    include_child_pages=True,
                ):
                    yield item
            elif block_type == "child_database" and include_databases:
                child_db_id = block["id"]
                async for item in self._extract_database(child_db_id):
                    yield item

    async def _search_all(
        self, include_databases: bool
    ) -> AsyncIterator[ExtractionResult]:
        """Search all accessible pages and databases in the workspace."""
        assert self._client is not None

        has_more = True
        start_cursor: str | None = None

        while has_more:
            body: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                body["start_cursor"] = start_cursor

            resp = await self._client.post("search", json=body)
            if resp.status_code != 200:
                break

            data = resp.json()
            for obj in data.get("results", []):
                obj_type = obj.get("object")

                if obj_type == "page":
                    content = await self._fetch_blocks_as_text(obj["id"])
                    yield ExtractionResult(
                        source_id=f"notion:page:{obj['id']}",
                        source_type="page",
                        title=self._extract_title(obj),
                        content=content,
                        size_bytes=len(content.encode("utf-8")),
                        metadata={
                            "page_id": obj["id"],
                            "created_time": obj.get("created_time"),
                            "last_edited_time": obj.get("last_edited_time"),
                            "url": obj.get("url"),
                        },
                        raw=obj,
                    )

                elif obj_type == "database" and include_databases:
                    async for item in self._extract_database(obj["id"]):
                        yield item

            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

    # ------------------------------------------------------------------
    # Block content extraction
    # ------------------------------------------------------------------

    async def _fetch_blocks_as_text(self, block_id: str) -> str:
        """Fetch all blocks under a page/block and convert to plain text."""
        blocks = await self._get_child_blocks(block_id)
        lines: list[str] = []

        for block in blocks:
            text = self._block_to_text(block)
            if text:
                lines.append(text)

            # Recurse into blocks with children
            if block.get("has_children", False):
                child_text = await self._fetch_blocks_as_text(block["id"])
                if child_text:
                    indented = "\n".join(
                        f"  {line}" for line in child_text.split("\n")
                    )
                    lines.append(indented)

        return "\n".join(lines)

    async def _get_child_blocks(self, block_id: str) -> list[dict[str, Any]]:
        """Paginate through child blocks of a block/page."""
        assert self._client is not None

        blocks: list[dict[str, Any]] = []
        has_more = True
        start_cursor: str | None = None

        while has_more:
            params: dict[str, Any] = {"page_size": 100}
            if start_cursor:
                params["start_cursor"] = start_cursor

            resp = await self._client.get(
                f"blocks/{block_id}/children", params=params
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            blocks.extend(data.get("results", []))
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

        return blocks

    # ------------------------------------------------------------------
    # Mapping
    # ------------------------------------------------------------------

    def _map_to_lurk(
        self,
        extraction: ExtractionResult,
        migration_item: MigrationItem,
        classification: ContentClassification,
    ) -> MappedItem:
        """Map a Notion extraction to the Lurk data model."""
        lurk_id = self._generate_lurk_id(MigrationSource.NOTION, extraction.source_id)
        collection = self._collection_for_type(classification.artifact_type)

        relationships: dict[str, list[str]] = {}

        parent_id = extraction.metadata.get("parent_id")
        if parent_id:
            parent_lurk_id = self._generate_lurk_id(
                MigrationSource.NOTION, f"notion:page:{parent_id}"
            )
            relationships["parent"] = [parent_lurk_id]

        database_id = extraction.metadata.get("database_id")
        if database_id:
            db_lurk_id = self._generate_lurk_id(
                MigrationSource.NOTION, f"notion:db:{database_id}"
            )
            relationships["database"] = [db_lurk_id]

        return MappedItem(
            migration_item=migration_item,
            content=extraction.content,
            lurk_collection=collection,
            lurk_document_id=lurk_id,
            relationships=relationships,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_title(obj: dict[str, Any]) -> str:
        """Extract the title from a Notion page or database object."""
        # Database title
        title_prop = obj.get("title")
        if isinstance(title_prop, list):
            return "".join(t.get("plain_text", "") for t in title_prop)

        # Page title from properties
        properties = obj.get("properties", {})
        for prop_name, prop_value in properties.items():
            if prop_value.get("type") == "title":
                title_items = prop_value.get("title", [])
                if title_items:
                    return "".join(t.get("plain_text", "") for t in title_items)

        return "Untitled"

    @staticmethod
    def _block_to_text(block: dict[str, Any]) -> str:
        """Convert a single Notion block to plain text."""
        block_type = block.get("type", "")
        content = block.get(block_type, {})

        # Most text blocks have a "rich_text" array
        rich_text = content.get("rich_text", [])
        if rich_text:
            text = "".join(rt.get("plain_text", "") for rt in rich_text)

            # Add prefix for structured blocks
            prefix_map = {
                "heading_1": "# ",
                "heading_2": "## ",
                "heading_3": "### ",
                "bulleted_list_item": "- ",
                "numbered_list_item": "1. ",
                "to_do": "[ ] ",
                "quote": "> ",
                "callout": "> ",
                "toggle": "> ",
            }
            prefix = prefix_map.get(block_type, "")

            # To-do: mark checked items
            if block_type == "to_do" and content.get("checked"):
                prefix = "[x] "

            return f"{prefix}{text}"

        # Code blocks
        if block_type == "code":
            code_text = "".join(
                rt.get("plain_text", "") for rt in content.get("rich_text", [])
            )
            language = content.get("language", "")
            return f"```{language}\n{code_text}\n```"

        # Divider
        if block_type == "divider":
            return "---"

        # Equation
        if block_type == "equation":
            return content.get("expression", "")

        return ""

    @staticmethod
    def _entry_properties_to_text(entry: dict[str, Any]) -> str:
        """Convert a database entry's properties to readable text."""
        lines: list[str] = []
        properties = entry.get("properties", {})

        for prop_name, prop_value in properties.items():
            prop_type = prop_value.get("type", "")
            value_str = ""

            if prop_type == "title":
                value_str = "".join(
                    t.get("plain_text", "") for t in prop_value.get("title", [])
                )
            elif prop_type == "rich_text":
                value_str = "".join(
                    t.get("plain_text", "") for t in prop_value.get("rich_text", [])
                )
            elif prop_type == "number":
                value_str = str(prop_value.get("number", ""))
            elif prop_type == "select":
                sel = prop_value.get("select")
                value_str = sel.get("name", "") if sel else ""
            elif prop_type == "multi_select":
                value_str = ", ".join(
                    s.get("name", "") for s in prop_value.get("multi_select", [])
                )
            elif prop_type == "date":
                date_obj = prop_value.get("date")
                if date_obj:
                    value_str = date_obj.get("start", "")
                    if date_obj.get("end"):
                        value_str += f" - {date_obj['end']}"
            elif prop_type == "checkbox":
                value_str = str(prop_value.get("checkbox", False))
            elif prop_type == "url":
                value_str = prop_value.get("url", "") or ""
            elif prop_type == "email":
                value_str = prop_value.get("email", "") or ""
            elif prop_type == "phone_number":
                value_str = prop_value.get("phone_number", "") or ""
            elif prop_type == "status":
                status = prop_value.get("status")
                value_str = status.get("name", "") if status else ""

            if value_str:
                lines.append(f"{prop_name}: {value_str}")

        return "\n".join(lines)
