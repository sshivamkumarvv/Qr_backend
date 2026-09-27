export enum Role {
  CUSTOMER = 'customer',
  RESTAURANT_OWNER = 'restaurant_owner',
  ADMIN = 'admin',
  RIDER = 'rider',
  BRANCH_MANAGER = 'branch_manager',
}

// Roles that operate scoped to a single branch (User.assignedBranchId).
// Used anywhere authorization needs to check "is this a branch-scoped
// staff role" generically, e.g. UsersService.assignBranch/unassignBranch.
export const BRANCH_SCOPED_ROLES: Role[] = [Role.RIDER, Role.BRANCH_MANAGER];
