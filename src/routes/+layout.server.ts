import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Get basic auth data from locals
  const { user } = locals;
  
  return {
    // User data - only pass basic authentication info at root level
    user: user ? {
      id: user.id,
      email: user.email,
      systemRole: user.systemRole,
      name: user.name
    } : null
  };
};
