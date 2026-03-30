"""Base migration source -- abstract class with shared extract/classify/map logic.

All concrete sources (Slack, Google Drive, Notion) extend this class and
implement source-specific extraction while sharing the common pipeline steps.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from ..classifier import ContentClassifier
from ..models import (
    ArtifactType,
    ContentClassification,
    MigrationItem,
    MigrationSource,
)

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Result of extracting a single item from a source."""

    source_id: str
    source_type: str
    title: str | None = None
    content: str = ""
    size_bytes: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class MappedItem:
    """An extracted + classified item mapped to the Lurk data model."""

    migration_item: MigrationItem
    content: str
    lurk_collection: str  # target Firestore collection
    lurk_document_id: str  # generated document ID
    relationships: dict[str, list[str]] = field(default_factory=dict)


class BaseMigrationSource(ABC):
    """Abstract base class for all migration sources.

    Concrete implementations must provide:
      - source_type property
      - authenticate()
      - extract_items()
      - _map_to_lurk() for source-specific field mapping
    """

    def __init__(self, credentials_ref: str, options: dict[str, Any] | None = None):
        self.credentials_ref = credentials_ref
        self.options = options or {}
        self._classifier = ContentClassifier()
        self._authenticated = False

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def source_type(self) -> MigrationSource:
        """Return the migration source type enum."""
        ...

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @abstractmethod
    async def authenticate(self) -> bool:
        """Authenticate with the source API using stored credentials.

        Returns True on success, raises on failure.
        """
        ...

    @abstractmethod
    async def extract_items(
        self,
        scope: dict[str, Any],
    ) -> AsyncIterator[ExtractionResult]:
        """Yield extracted items from the source within the given scope."""
        ...

    # ------------------------------------------------------------------
    # Shared pipeline methods
    # ------------------------------------------------------------------

    def classify(self, item: ExtractionResult) -> ContentClassification:
        """Classify an extracted item using the content classifier."""
        return self._classifier.classify_text(
            item.content,
            source_type=item.source_type,
            filename=item.metadata.get("filename"),
            mime_type=item.metadata.get("mime_type"),
        )

    def map_item(self, item: ExtractionResult) -> MappedItem:
        """Map an extracted + classified item to the Lurk data model.

        This method performs classification, then delegates source-specific
        field mapping to `_map_to_lurk()`.
        """
        classification = self.classify(item)

        migration_item = MigrationItem(
            source_id=item.source_id,
            source_type=item.source_type,
            title=item.title,
            size_bytes=item.size_bytes,
            classification=classification,
            metadata=item.metadata,
        )

        return self._map_to_lurk(item, migration_item, classification)

    @abstractmethod
    def _map_to_lurk(
        self,
        extraction: ExtractionResult,
        migration_item: MigrationItem,
        classification: ContentClassification,
    ) -> MappedItem:
        """Source-specific mapping from extraction to the Lurk data model."""
        ...

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    async def count_items(self, scope: dict[str, Any]) -> int:
        """Count total items to migrate without extracting content.

        Default implementation iterates the extract generator. Subclasses
        should override with a more efficient API call where possible.
        """
        count = 0
        async for _ in self.extract_items(scope):
            count += 1
        return count

    @staticmethod
    def _generate_lurk_id(source: MigrationSource, source_id: str) -> str:
        """Generate a deterministic Lurk document ID from source info."""
        import hashlib

        raw = f"{source.value}:{source_id}"
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    @staticmethod
    def _collection_for_type(artifact_type: ArtifactType) -> str:
        """Map an artifact type to a Firestore collection name."""
        mapping: dict[ArtifactType, str] = {
            ArtifactType.MESSAGE: "messages",
            ArtifactType.THREAD: "threads",
            ArtifactType.DOCUMENT: "documents",
            ArtifactType.SPREADSHEET: "documents",
            ArtifactType.PRESENTATION: "documents",
            ArtifactType.PDF: "documents",
            ArtifactType.IMAGE: "files",
            ArtifactType.FILE: "files",
            ArtifactType.PAGE: "documents",
            ArtifactType.DATABASE: "databases",
            ArtifactType.DECISION: "decisions",
            ArtifactType.ACTION_ITEM: "action_items",
            ArtifactType.MEETING_NOTES: "documents",
            ArtifactType.TOPIC_CLUSTER: "topic_clusters",
        }
        return mapping.get(artifact_type, "misc")
