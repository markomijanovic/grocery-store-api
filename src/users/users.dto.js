export function toPublicUser(user) {
  return {
    id: user._id.toHexString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    nodeId: user.nodeId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}