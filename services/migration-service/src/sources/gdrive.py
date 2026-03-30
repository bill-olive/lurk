"""Google Drive migration source implementation.

Migrates Google Docs, Sheets, Slides, PDFs, and other files from Google Drive.
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

_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"

# Google MIME types -> export MIME + artifact type
_GOOGLE_NATIVE_TYPES: dict[str, dict[str, str]] = {
    "application/vnd.google-apps.document": {
        "export_mime": "text/plain",
        "artifact": "document",
    },
    "application/vnd.google-apps.spreadsheet": {
        "export_mime": "text/csv",
        "artifact": "spreadsheet",
    },
    "application/vnd.google-apps.presentation": {
        "export_mime": "text/plain",
        "artifact": "presentation",
    },
    "application/vnd.google-apps.drawing": {
        "export_mime": "image/png",
        "artifact": "image",
    },
}


class GDriveMigrationSource(BaseMigrationSource):
    """Migrates files and documents from Google Drive.

    Scope options:
      - folder_ids: list[str] -- specific folders to migrate
      - file_ids: list[str] -- specific files to migrate
      - mime_types: list[str] -- filter by MIME type
      - include_trashed: bool -- include trashed files (default False)
      - include_shared: bool -- include shared drives (default True)
      - recursive: bool -- recurse into subfolders (default True)
    """

    def __init__(self, credentials_ref: str, options: dict[str, Any] | None = None):
        super().__init__(credentials_ref, options)
        self._access_token: str | None = None
        self._client: httpx.AsyncClient | None = None

    @property
    def source_type(self) -> MigrationSource:
        return MigrationSource.GDRIVE

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def authenticate(self) -> bool:
        """Authenticate with Google Drive using OAuth2 credentials.

        In production, the credentials_ref is resolved from secret storage
        and exchanged for an access token via google-auth.
        """
        self._access_token = self.credentials_ref  # placeholder
        self._client = httpx.AsyncClient(
            base_url=_DRIVE_API_BASE,
            headers={"Authorization": f"Bearer {self._access_token}"},
            timeout=30.0,
        )

        # Verify token
        resp = await self._client.get("about", params={"fields": "user"})
        if resp.status_code != 200:
            raise ConnectionError(f"Google Drive auth failed: {resp.status_code}")

        data = resp.json()
        logger.info(
            "Google Drive authenticated as %s",
            data.get("user", {}).get("emailAddress", "unknown"),
        )
        self._authenticated = True
        return True

    # ------------------------------------------------------------------
    # Extraction
    # ------------------------------------------------------------------

    async def extract_items(
        self,
        scope: dict[str, Any],
    ) -> AsyncIterator[ExtractionResult]:
        """Extract files from Google Drive."""
        assert self._client is not None, "Must authenticate before extraction"

        explicit_file_ids: list[str] | None = scope.get("file_ids")
        folder_ids: list[str] | None = scope.get("folder_ids")
        recursive: bool = scope.get("recursive", True)

        if explicit_file_ids:
            for file_id in explicit_file_ids:
                result = await self._extract_single_file(file_id)
                if result:
                    yield result

        if folder_ids:
            for folder_id in folder_ids:
                async for item in self._extract_folder(
                    folder_id, scope, recursive=recursive
                ):
                    yield item

        # If no explicit scope, list all files in My Drive
        if not explicit_file_ids and not folder_ids:
            async for item in self._list_and_extract(scope):
                yield item

    async def _extract_folder(
        self,
        folder_id: str,
        scope: dict[str, Any],
        *,
        recursive: bool = True,
    ) -> AsyncIterator[ExtractionResult]:
        """Extract all files from a folder, optionally recursing."""
        assert self._client is not None

        page_token: str | None = None
        query_parts = [f"'{folder_id}' in parents"]
        if not scope.get("include_trashed", False):
            query_parts.append("trashed = false")

        query = " and ".join(query_parts)

        while True:
            params: dict[str, Any] = {
                "q": query,
                "pageSize": 100,
                "fields": "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,owners,parents,trashed,webViewLink)",
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await self._client.get("files", params=params)
            data = resp.json()

            for f in data.get("files", []):
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    if recursive:
                        async for item in self._extract_folder(
                            f["id"], scope, recursive=True
                        ):
                            yield item
                else:
                    result = await self._extract_file_metadata_and_content(f)
                    if result:
                        yield result

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    async def _list_and_extract(
        self, scope: dict[str, Any]
    ) -> AsyncIterator[ExtractionResult]:
        """List all files in My Drive and extract them."""
        assert self._client is not None

        page_token: str | None = None
        query_parts: list[str] = []

        if not scope.get("include_trashed", False):
            query_parts.append("trashed = false")

        mime_filter: list[str] | None = scope.get("mime_types")
        if mime_filter:
            mime_clauses = [f"mimeType = '{m}'" for m in mime_filter]
            query_parts.append(f"({' or '.join(mime_clauses)})")

        query = " and ".join(query_parts) if query_parts else None

        while True:
            params: dict[str, Any] = {
                "pageSize": 100,
                "fields": "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,owners,parents,trashed,webViewLink)",
            }
            if query:
                params["q"] = query
            if page_token:
                params["pageToken"] = page_token

            resp = await self._client.get("files", params=params)
            data = resp.json()

            for f in data.get("files", []):
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    continue
                result = await self._extract_file_metadata_and_content(f)
                if result:
                    yield result

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    async def _extract_single_file(
        self, file_id: str
    ) -> ExtractionResult | None:
        """Fetch metadata and content for a single file by ID."""
        assert self._client is not None

        resp = await self._client.get(
            f"files/{file_id}",
            params={
                "fields": "id,name,mimeType,size,createdTime,modifiedTime,owners,parents,trashed,webViewLink"
            },
        )
        if resp.status_code != 200:
            logger.warning("Failed to fetch file %s: %s", file_id, resp.status_code)
            return None

        return await self._extract_file_metadata_and_content(resp.json())

    async def _extract_file_metadata_and_content(
        self, file_meta: dict[str, Any]
    ) -> ExtractionResult | None:
        """Given Drive file metadata, extract content."""
        assert self._client is not None

        file_id = file_meta["id"]
        mime_type = file_meta.get("mimeType", "")
        name = file_meta.get("name", file_id)

        content = ""

        # Google native types: export
        if mime_type in _GOOGLE_NATIVE_TYPES:
            export_info = _GOOGLE_NATIVE_TYPES[mime_type]
            try:
                resp = await self._client.get(
                    f"files/{file_id}/export",
                    params={"mimeType": export_info["export_mime"]},
                )
                if resp.status_code == 200:
                    content = resp.text
            except Exception:
                logger.warning("Failed to export %s", file_id, exc_info=True)

        # Binary files: we record metadata only (actual bytes handled
        # separately via GCS transfer in the pipeline)
        source_type = _GOOGLE_NATIVE_TYPES.get(mime_type, {}).get(
            "artifact", "file"
        )

        owners = file_meta.get("owners", [])
        owner_emails = [o.get("emailAddress", "") for o in owners]

        return ExtractionResult(
            source_id=f"gdrive:{file_id}",
            source_type=source_type,
            title=name,
            content=content,
            size_bytes=int(file_meta.get("size", len(content.encode("utf-8")))),
            metadata={
                "file_id": file_id,
                "mime_type": mime_type,
                "filename": name,
                "created_time": file_meta.get("createdTime"),
                "modified_time": file_meta.get("modifiedTime"),
                "owners": owner_emails,
                "parents": file_meta.get("parents", []),
                "web_view_link": file_meta.get("webViewLink"),
            },
            raw=file_meta,
        )

    # ------------------------------------------------------------------
    # Mapping
    # ------------------------------------------------------------------

    def _map_to_lurk(
        self,
        extraction: ExtractionResult,
        migration_item: MigrationItem,
        classification: ContentClassification,
    ) -> MappedItem:
        """Map a Google Drive file to the Lurk data model."""
        lurk_id = self._generate_lurk_id(MigrationSource.GDRIVE, extraction.source_id)
        collection = self._collection_for_type(classification.artifact_type)

        relationships: dict[str, list[str]] = {}

        # Parent folder relationship
        parents = extraction.metadata.get("parents", [])
        if parents:
            parent_ids = [
                self._generate_lurk_id(MigrationSource.GDRIVE, f"gdrive:{pid}")
                for pid in parents
            ]
            relationships["parent_folder"] = parent_ids

        return MappedItem(
            migration_item=migration_item,
            content=extraction.content,
            lurk_collection=collection,
            lurk_document_id=lurk_id,
            relationships=relationships,
        )

    # ------------------------------------------------------------------
    # Count (efficient override)
    # ------------------------------------------------------------------

    async def count_items(self, scope: dict[str, Any]) -> int:
        """Count files without downloading content."""
        assert self._client is not None

        query_parts: list[str] = ["trashed = false"]
        folder_ids: list[str] | None = scope.get("folder_ids")

        # For simplicity, count via list endpoint
        count = 0
        page_token: str | None = None

        while True:
            params: dict[str, Any] = {
                "pageSize": 100,
                "fields": "nextPageToken,files(id)",
            }
            if folder_ids:
                folder_clauses = [f"'{fid}' in parents" for fid in folder_ids]
                params["q"] = f"({' or '.join(folder_clauses)}) and trashed = false"
            else:
                params["q"] = "trashed = false"
            if page_token:
                params["pageToken"] = page_token

            resp = await self._client.get("files", params=params)
            data = resp.json()
            count += len(data.get("files", []))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return count
