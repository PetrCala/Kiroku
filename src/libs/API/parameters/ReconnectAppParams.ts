type ReconnectAppParams = {
  updateIDFrom?: number;

  /** Floor of the sessions snapshot when the server answers with a full re-baseline (see `OpenAppParams`). */
  sessionsFrom?: number;
  // mostRecentReportActionLastModified?: string;
  // policyIDList: string[];
};

export default ReconnectAppParams;
