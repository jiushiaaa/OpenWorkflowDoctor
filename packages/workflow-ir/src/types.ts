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

export type NodeIR = {
  id: string;
  name: string;
  type: string;
  typeFamily: NodeTypeFamily;
  parameters: NodeParameterSummary[];
};

export type EdgeIR = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceOutput: string;
  sourceOutputIndex: number;
};

export type WorkflowIR = {
  id?: string;
  name: string;
  nodes: NodeIR[];
  edges: EdgeIR[];
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
