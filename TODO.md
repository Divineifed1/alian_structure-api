# TODO

## Portfolio REST API (OpenAPI/Swagger) Implementation

### Step 1: Add portfolio management DTOs + swagger schemas
- Add `src/investment/portfolio/dto/api-error.dto.ts` to document global error shape.
- Add `src/investment/portfolio/dto/portfolio-management.dto.ts` for request/response DTOs.

### Step 2: Add archive-by-status support in service
- Edit `src/investment/portfolio/services/portfolio.service.ts` to implement `archivePortfolio()`.

### Step 3: Implement new controller with exact routes
- Add `src/investment/portfolio/portfolio-management.controller.ts`.
- Controller must expose:
  - POST /api/portfolio
  - GET /api/portfolio/:id
  - GET /api/portfolio
  - PUT /api/portfolio/:id
  - DELETE /api/portfolio/:id (archive)
- Ensure correct HTTP status codes and Swagger `@ApiResponse` documentation.

### Step 4: Wire controller into module
- Edit `src/investment/portfolio/portfolio.module.ts` to include the new controller.

### Step 5: Add E2E tests
- Added `test/portfolio/portfolio-management.e2e-spec.ts` (note: token-helper may need alignment with your auth test utilities).

### Step 6: Add load test
- Added `test/portfolio/portfolio-management.loadtest.sh` (autocannon-based). 


### Step 7: Verify
- Run e2e tests.
- Run load test command.

