export type NodeTypeFamily = "known" | "unknown";

export type ParameterValueType =
  | "array"
  | "boolean"
  | "null"
  | "number"
  | "object"
  | "string"
  | "unknown";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type VerificationStatus = "pass" | "hold" | "fail";
export type HumanReviewDecision = "undecided" | "accepted" | "held" | "rejected";

export type NodeParameterSummary = {
  key: string;
  valueType: ParameterValueType;
  preview: string;
  redacted?: boolean;
};

export type CredentialReferenceSummary = {
  credentialReferencePresent: boolean;
  credentialTypes: string[];
  credentialCount: number;
};

export type WorkflowSourceKind =
  | "n8n-exported-json"
  | "n8n-readonly"
  | "dify-dsl"
  | "coze-definition"
  | "custom-graph-json";
export type WorkflowSourcePlatform = "n8n" | "dify" | "coze" | "custom";
export type WorkflowImportMethod = "file-upload" | "read-only-connection" | "manual-artifact" | "sample";
export type WorkflowSourceStability = "stable" | "experimental" | "best-effort";

export type RedactionSummary = {
  redactedValueCount: number;
  redactedKeys: string[];
  notes: string[];
};

export type WorkflowSourceDiagnostic = {
  code: string;
  message: string;
  severity: RiskSeverity;
  nodeId?: string;
  evidence: string[];
};

export type WorkflowSourceMetadata = {
  adapterId: string;
  sourceKind: WorkflowSourceKind;
  sourcePlatform: WorkflowSourcePlatform;
  importMethod: WorkflowImportMethod;
  stability: WorkflowSourceStability;
  sourceVersion?: string;
  sourceAppMode?: string;
  sourceLabel?: string;
  app?: {
    name: string;
    description?: string;
    mode?: string;
    icon?: string;
    iconBackground?: string;
    useIconAsAnswerIcon?: boolean;
  };
  nodeCount: number;
  edgeCount: number;
  redactionSummary: RedactionSummary;
  parserWarnings: string[];
  diagnostics: WorkflowSourceDiagnostic[];
  environmentVariables?: {
    name: string;
    declaredType?: string;
    valueExisted: boolean;
    redacted: boolean;
    redactionReason?: string;
  }[];
};

export type NodeIR = {
  id: string;
  name: string;
  type: string;
  typeFamily: NodeTypeFamily;
  parameters: NodeParameterSummary[];
  credentialSummary?: CredentialReferenceSummary;
};

export type EdgeIR = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceOutput: string;
  sourceOutputIndex: number;
  targetInput?: string;
};

export type WorkflowIR = {
  id?: string;
  name: string;
  nodes: NodeIR[];
  edges: EdgeIR[];
  source?: WorkflowSourceMetadata;
};

export type RiskIssue = {
  id: string;
  severity: RiskSeverity;
  nodeId?: string;
  title: string;
  explanation: string;
  suggestedFix: string;
  evidence: string[];
};

export type PatchOperation =
  | {
      type: "insert_node_before";
      targetNodeId: string;
      newNode: NodeIR;
    }
  | {
      type: "insert_node_after";
      targetNodeId: string;
      newNode: NodeIR;
    }
  | {
      type: "insert_error_branch";
      targetNodeId: string;
      newNode: NodeIR;
    }
  | {
      type: "insert_branch_route";
      targetNodeId: string;
      sourceOutputIndex: number;
      newNode: NodeIR;
    }
  | {
      type: "update_node_parameters";
      targetNodeId: string;
      parameters: Record<string, unknown>;
    };

export type PatchProposal = {
  summary: string;
  operations: PatchOperation[];
  risksAddressed: string[];
  expectedImpact: string[];
  risksIntroduced: string[];
  requiresHumanReview: boolean;
};

export type PatchDiffLine = {
  id: string;
  marker: "+" | "~";
  operationType: PatchOperation["type"];
  targetNodeId: string;
  targetNodeName: string;
  title: string;
  details: string[];
};

export type VerificationGate = {
  id: string;
  title: string;
  status: VerificationStatus;
  explanation: string;
};

export type VerificationReport = {
  status: VerificationStatus;
  checkedGates: VerificationGate[];
  passedScenarios: string[];
  failedScenarios: string[];
  warnings: string[];
  requiredRemediation: string[];
};

export type WorkflowSummary = {
  workflowName: string;
  overview: string;
  entryNodes: string[];
  terminalNodes: string[];
  sideEffectNodes: string[];
  riskCounts: Record<RiskSeverity, number>;
  recommendedStatus: VerificationStatus;
};

export type PatchConflictSeverity = "info" | "hold" | "blocker";

export type PatchConflictCode =
  | "target_missing"
  | "duplicate_new_node_id"
  | "branch_route_exists"
  | "unsupported_operation"
  | "unsupported_node_type"
  | "unsupported_parameter"
  | "stale_report"
  | "overlapping_operation"
  | "unmapped_ai_reference"
  | "semantic_validation_failed";

export type PatchConflict = {
  id: string;
  severity: PatchConflictSeverity;
  operationIndexes: number[];
  targetNodeId?: string;
  issueId?: string;
  code: PatchConflictCode;
  explanation: string;
};

export type PatchProposalSource = {
  kind: "deterministic" | "ai-assisted";
  generatedAt?: string;
  inputFingerprint?: string;
  modelLabel?: string;
  validation?: {
    schema: VerificationStatus;
    semantic: VerificationStatus;
    conflictStatus: "none" | PatchConflictSeverity;
  };
  safetyNotes: string[];
};

export type AiPatchProposalInput = {
  schemaVersion: "openworkflowdoctor.ai-patch-input.v1";
  inputFingerprint: string;
  request: string;
  workflow: {
    alias: "workflow";
    nodeCount: number;
    edgeCount: number;
    riskCounts: Record<RiskSeverity, number>;
  };
  graph: {
    nodes: {
      id: string;
      type: string;
      typeFamily: NodeTypeFamily;
    }[];
    edges: {
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourceOutput: string;
      sourceOutputIndex: number;
    }[];
  };
  issues: {
    id: string;
    severity: RiskSeverity;
    nodeId?: string;
    title: string;
    explanation: string;
    suggestedFix: string;
  }[];
  deterministicPatch: {
    summary: string;
    operationTypes: PatchOperation["type"][];
    risksAddressed: string[];
    expectedImpact: string[];
  };
  capabilityManifest: {
    allowedOperationTypes: PatchOperation["type"][];
    allowedSyntheticNodeTypes: string[];
    allowedParameterUpdates: {
      key: "timeout";
      minimum: number;
      maximum: number;
    }[];
    unsupportedOperationTypes: PatchOperation["type"][];
  };
};

export type AiPatchProposalCandidate = {
  schemaVersion: "openworkflowdoctor.ai-patch-proposal.v1";
  source: "ai";
  createdAt: string;
  inputFingerprint: string;
  modelLabel?: string;
  proposal: PatchProposal;
  conflicts: PatchConflict[];
  safetyNotes: string[];
};

export type AiPatchProposalValidationResult = {
  proposal: PatchProposal;
  conflicts: PatchConflict[];
  canPreview: boolean;
  patchSource: PatchProposalSource;
};

export type DoctorReport = {
  workflow: WorkflowIR;
  summary: WorkflowSummary;
  view: WorkflowViewModel;
  issues: RiskIssue[];
  proposal: PatchProposal;
  patchDiff: PatchDiffLine[];
  patchedWorkflow: WorkflowIR;
  patchedSummary: WorkflowSummary;
  patchedView: WorkflowViewModel;
  patchedIssues: RiskIssue[];
  verification: VerificationReport;
  acceptanceRecommendation: VerificationStatus;
  patchSource?: PatchProposalSource;
};

export type RiskDelta = {
  before: Record<RiskSeverity, number>;
  after: Record<RiskSeverity, number>;
};

export type IssueDelta = {
  resolvedIssueIds: string[];
  remainingIssueIds: string[];
  introducedIssueIds: string[];
};

export type HumanReview = {
  decision: HumanReviewDecision;
  reviewerNote: string;
  decidedAt?: string;
  confirmedChecklistItemIds: string[];
};

export type HumanReviewValidation = {
  status: VerificationStatus;
  missingChecklistItemIds: string[];
  explanation: string;
};

export type DoctorReviewPacket = {
  schemaVersion: "openworkflowdoctor.review-packet.v1";
  generatedAt: string;
  workflowName: string;
  source?: WorkflowSourceMetadata;
  reviewTargetFingerprint: string;
  acceptanceRecommendation: VerificationStatus;
  riskDelta: RiskDelta;
  issueDelta: IssueDelta;
  humanReview: HumanReview;
  humanReviewValidation: HumanReviewValidation;
  acceptanceChecklist: {
    id: string;
    label: string;
    status: VerificationStatus;
    action: string;
  }[];
  original: {
    workflow: WorkflowIR;
    summary: WorkflowSummary;
    issues: RiskIssue[];
  };
  patch: {
    proposal: PatchProposal;
    proposalSource?: PatchProposalSource;
    patchDiff: PatchDiffLine[];
    patchedWorkflow: WorkflowIR;
    patchedSummary: WorkflowSummary;
    patchedIssues: RiskIssue[];
  };
  verification: VerificationReport;
};

export type WorkflowViewNode = {
  id: string;
  label: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  issueCount: number;
  highestSeverity?: RiskSeverity;
};

export type WorkflowViewEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type WorkflowViewModel = {
  nodes: WorkflowViewNode[];
  edges: WorkflowViewEdge[];
};

export type WorkflowAdjacencyMap = {
  incoming: Map<string, string[]>;
  outgoing: Map<string, string[]>;
};
