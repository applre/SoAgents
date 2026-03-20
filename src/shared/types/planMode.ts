export interface ExitPlanModeRequest {
  requestId: string;
  plan?: string;
  resolved?: 'approved' | 'rejected';
}

export interface EnterPlanModeRequest {
  requestId: string;
  resolved?: 'approved' | 'rejected';
}
