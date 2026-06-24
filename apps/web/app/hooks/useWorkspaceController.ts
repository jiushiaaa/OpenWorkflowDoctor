import { useCallback, useEffect, useRef, useState } from "react";
import { parseN8nWorkflow } from "@openworkflowdoctor/workflow-ir";
import type { SampleWorkflowCatalogItem } from "../lib/sample-workflows";
import {
  createIndexedDbWorkspaceRepository,
  createWorkflowDocumentFromWorkflowIr,
  type ReviewPacketArtifact,
  type WorkflowDocument,
  type WorkspaceRepository
} from "../lib/workspace-store";

export function useWorkspaceController({ onWorkspaceChanged }: { onWorkspaceChanged: () => void }) {
  const repositoryRef = useRef<WorkspaceRepository | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workflowDocuments, setWorkflowDocuments] = useState<WorkflowDocument[]>([]);
  const [activeWorkflowDocumentId, setActiveWorkflowDocumentId] = useState<string | null>(null);
  const [activeReviewPacketArtifacts, setActiveReviewPacketArtifacts] = useState<ReviewPacketArtifact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeDocument =
    workflowDocuments.find((document) => document.id === activeWorkflowDocumentId) ?? null;

  const loadWorkspaceSnapshot = useCallback(async (nextActiveDocumentId?: string | null) => {
    const repository = repositoryRef.current;
    if (!repository) {
      return;
    }

    const workspace = await repository.getWorkspace();
    const documents = await repository.listWorkflowDocuments();
    const activeId =
      nextActiveDocumentId !== undefined
        ? nextActiveDocumentId
        : workspace.activeWorkflowDocumentId;
    const nextActiveId = activeId && documents.some((document) => document.id === activeId)
      ? activeId
      : documents[0]?.id ?? null;

    setWorkflowDocuments(documents);
    setActiveWorkflowDocumentId(nextActiveId);
    setActiveReviewPacketArtifacts(
      nextActiveId ? await repository.listReviewPacketArtifacts(nextActiveId) : []
    );
  }, []);

  const updateActiveDocument = useCallback((updater: (document: WorkflowDocument) => WorkflowDocument) => {
    if (!activeDocument) {
      return;
    }

    const repository = repositoryRef.current;
    const nextDocument = {
      ...updater(activeDocument),
      updatedAt: new Date().toISOString()
    };

    setWorkflowDocuments((current) =>
      current.map((document) => (document.id === nextDocument.id ? nextDocument : document))
    );
    void repository?.saveWorkflowDocument(nextDocument).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : "Unable to save workflow document.");
    });
  }, [activeDocument]);

  const importWorkflow = useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const repository = repositoryRef.current;
      if (!repository) {
        throw new Error("Local workspace storage is not ready.");
      }
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const parsedWorkflow = parseN8nWorkflow(json);
      const document = createWorkflowDocumentFromWorkflowIr({
        workflow: parsedWorkflow,
        sourceKind: "imported-file",
        sourceLabel: file.name
      });

      await repository.saveWorkflowDocument(document);
      await repository.setActiveWorkflowDocument(document.id);
      await loadWorkspaceSnapshot(document.id);
      onWorkspaceChanged();
      setError(null);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import workflow JSON."
      );
    }
  }, [loadWorkspaceSnapshot, onWorkspaceChanged]);

  const loadSampleWorkflow = useCallback(async (sample: SampleWorkflowCatalogItem) => {
    try {
      const repository = repositoryRef.current;
      if (!repository) {
        throw new Error("Local workspace storage is not ready.");
      }

      const parsedWorkflow = parseN8nWorkflow(sample.workflow);
      const document = createWorkflowDocumentFromWorkflowIr({
        workflow: parsedWorkflow,
        sourceKind: "sample",
        sourceLabel: sample.filename
      });

      await repository.saveWorkflowDocument(document);
      await repository.setActiveWorkflowDocument(document.id);
      await loadWorkspaceSnapshot(document.id);
      onWorkspaceChanged();
      setError(null);
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : "Unable to load sample workflow.");
    }
  }, [loadWorkspaceSnapshot, onWorkspaceChanged]);

  const selectWorkflowDocument = useCallback(async (workflowDocumentId: string) => {
    const repository = repositoryRef.current;
    if (!repository) {
      return;
    }

    await repository.setActiveWorkflowDocument(workflowDocumentId);
    await loadWorkspaceSnapshot(workflowDocumentId);
    onWorkspaceChanged();
    setError(null);
  }, [loadWorkspaceSnapshot, onWorkspaceChanged]);

  const saveReviewPacketArtifact = useCallback(async (artifact: ReviewPacketArtifact) => {
    const repository = repositoryRef.current;
    if (!repository) {
      return;
    }

    await repository.saveReviewPacketArtifact(artifact);
  }, []);

  const clearWorkspaceData = useCallback(async () => {
    const repository = repositoryRef.current;
    if (repository) {
      await repository.clearWorkspaceData();
    }
    setWorkflowDocuments([]);
    setActiveWorkflowDocumentId(null);
    setActiveReviewPacketArtifacts([]);
    onWorkspaceChanged();
    setError(null);
  }, [onWorkspaceChanged]);

  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      try {
        if (!window.indexedDB) {
          throw new Error("IndexedDB is unavailable in this browser.");
        }

        const repository = createIndexedDbWorkspaceRepository(window.indexedDB);
        repositoryRef.current = repository;
        const workspace = await repository.initialize();
        const documents = await repository.listWorkflowDocuments();
        const activeId = workspace.activeWorkflowDocumentId ?? documents[0]?.id ?? null;
        const artifacts = activeId ? await repository.listReviewPacketArtifacts(activeId) : [];

        if (!isMounted) {
          return;
        }

        setWorkflowDocuments(documents);
        setActiveWorkflowDocumentId(activeId);
        setActiveReviewPacketArtifacts(artifacts);
        setWorkspaceLoaded(true);
      } catch (workspaceError) {
        if (!isMounted) {
          return;
        }
        setError(workspaceError instanceof Error ? workspaceError.message : "Unable to initialize local workspace.");
        setWorkspaceLoaded(true);
      }
    }

    void initializeWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    workspaceLoaded,
    workflowDocuments,
    activeWorkflowDocumentId,
    activeDocument,
    activeReviewPacketArtifacts,
    error,
    setError,
    loadWorkspaceSnapshot,
    updateActiveDocument,
    importWorkflow,
    loadSampleWorkflow,
    selectWorkflowDocument,
    saveReviewPacketArtifact,
    clearWorkspaceData
  };
}
