type OpenAppParams = {
  // policyIDList: string[];
  enablePriorityModeFilter: boolean;

  /**
   * Floor (epoch ms) of the sessions snapshot: only sessions started at or
   * after it ship, plus the live one. Omitted, the server ships the whole
   * history (see `SessionWindow`).
   */
  sessionsFrom?: number;
};

export default OpenAppParams;
