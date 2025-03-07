module.exports = {
  apps: [
    {
      name: "unify",
      script: "bun",
      args: "run index.ts",
      cwd: "./",
      interpreter: "none",
    },
  ],
};
