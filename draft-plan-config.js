window.DraftPlanConfig = {
  plans: {
    superflex: {
      note: "Assumes a QB-eligible superflex spot",
      checkpoints: [
        { label: "By R2", advice: "Have 1 QB", requirements: { positions: { QB: 1 } } },
        { label: "By R3", advice: "Have QB + 2 RB/WR/TE", requirements: { positions: { QB: 1 }, groups: [{ positions: ["RB", "WR", "TE"], minimum: 2 }] } },
        { label: "By R4", advice: "Add 2-3 premium skill players", requirements: { positions: { QB: 1 }, groups: [{ positions: ["RB", "WR", "TE"], minimum: 2 }] } },
        { label: "By R5", advice: "Consider QB2 soon" },
        { label: "R8-11", advice: "Prioritize QB2/QB3 depth", requirements: { positions: { QB: 2 } } },
        { label: "Final 2", advice: "Draft K/D/ST unless streaming" },
      ],
    },
    standard: {
      note: "1 QB, 2 RB, 2 WR, TE, FLEX",
      checkpoints: [
        { label: "By R2", advice: "Have 1 RB; 2 RBs fine", requirements: { positions: { RB: 1 } } },
        { label: "By R3", advice: "Prefer 2 RBs", requirements: { positions: { RB: 2 } } },
        { label: "By R4", advice: "Target 2 RBs; 3 okay", requirements: { positions: { RB: 2 } } },
        { label: "By R5", advice: "3 RBs viable; catch up WR", requirements: { positions: { RB: 2, WR: 1 } } },
        { label: "R8-11", advice: "Add QB/TE if needed", requirements: { positions: { QB: 1, TE: 1 } } },
        { label: "Final 2", advice: "Draft K/D/ST" },
      ],
    },
    halfPpr: {
      note: "1 QB, 2 RB, 2 WR, TE, FLEX",
      checkpoints: [
        { label: "By R2", advice: "Have 1 RB", requirements: { positions: { RB: 1 } } },
        { label: "By R3", advice: "Prefer 2 RBs", requirements: { positions: { RB: 2 } } },
        { label: "By R4", advice: "Have 2 RBs + 1 WR", requirements: { positions: { RB: 2, WR: 1 } } },
        { label: "By R5", advice: "Add WR firepower", requirements: { positions: { RB: 2, WR: 2 } } },
        { label: "R8-11", advice: "QB/TE window", requirements: { positions: { QB: 1, TE: 1 } } },
        { label: "Final 2", advice: "Draft K/D/ST" },
      ],
    },
    ppr: {
      note: "1 QB, 2 RB, 2 WR, TE, FLEX",
      checkpoints: [
        { label: "By R2", advice: "1 RB or WR/WR start okay", requirements: { groups: [{ positions: ["RB", "WR"], minimum: 2 }] } },
        { label: "By R3", advice: "Build 1 RB + 2 WR or 2 RB + 1 WR", requirements: { groups: [{ positions: ["RB", "WR"], minimum: 3 }] } },
        { label: "By R4", advice: "2 RB or Hero-RB WR build", requirements: { groups: [{ positions: ["RB", "WR"], minimum: 4 }] } },
        { label: "By R5", advice: "Balance RB/WR; consider elite TE", requirements: { groups: [{ positions: ["RB", "WR", "TE"], minimum: 5 }] } },
        { label: "R8-11", advice: "QB/TE window", requirements: { positions: { QB: 1, TE: 1 } } },
        { label: "Final 2", advice: "Draft K/D/ST" },
      ],
    },
  },
  rosterTargets: {
    superflex: { QB: 2, RB: 2, WR: 2, TE: 1 },
    standard: { QB: 1, RB: 2, WR: 2, TE: 1 },
    halfPpr: { QB: 1, RB: 2, WR: 2, TE: 1 },
    ppr: { QB: 1, RB: 2, WR: 2, TE: 1 },
  },
};
