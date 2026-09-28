# AWS phase (not implemented yet)

The app is already container-ready. When you are ready, the planned pieces are:

- Image registry: Amazon ECR
- Compute: ECS Fargate or App Runner (uses the `/health` endpoint)
- Database: replace `src/store.js` with RDS or DynamoDB (same function signatures)
- Secrets: AWS Secrets Manager / SSM Parameter Store for `JWT_SECRET`
- CI/CD: add a `deploy` job to `.github/workflows/ci.yml` using GitHub OIDC to assume an IAM role