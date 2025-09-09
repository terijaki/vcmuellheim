import type { Access, FieldAccess, User, Where } from "payload";

export const isRoleAdmin = (role: User["role"]) => {
	if (role === "admin") return true;
	return false;
};
export const isRoleModerator = (role: User["role"]) => {
	if (role === "admin") return true;
	if (role === "moderator") return true;
	return false;
};
export const isRoleOfficial = (role: User["role"]) => {
	if (role === "admin") return true;
	if (role === "moderator") return true;
	if (role === "official") return true;
	return false;
};

export const isAdmin: Access = ({ req: { user } }) => {
	if (isRoleAdmin(user?.role)) return true;
	return false;
};

export const isModerator: Access = ({ req: { user } }) => {
	if (isRoleModerator(user?.role)) return true;
	return false;
};

export const isOfficial: Access = ({ req: { user } }) => {
	if (isRoleOfficial(user?.role)) return true;
	return false;
};

export const isUser: Access = ({ req: { user } }) => {
	return Boolean(user);
};

export const isAdminOrSelf: Access = ({ req: { user } }) => {
	if (isRoleAdmin(user?.role)) return true;
	if (user)
		return {
			or: [
				{
					id: {
						equals: user.id,
					},
				},
				{
					email: {
						equals: user.email,
					},
				},
			],
		} as Where;

	return false;
};

export const isModeratorOrSelf: Access = ({ req: { user } }) => {
	if (isRoleModerator(user?.role)) return true;
	if (user)
		return {
			or: [
				{
					id: {
						equals: user.id,
					},
				},
				{
					email: {
						equals: user.email,
					},
				},
			],
		} as Where;

	return false;
};

export const isModeratorOrAuthor: Access = ({ req: { user } }) => {
	if (isRoleModerator(user?.role)) return true;
	if (user)
		// TODO this does not work since the authors are not in the jwt
		return {
			authors: {
				contains: user.id,
			},
		};
	return false;
};

export const isFieldAdmin: FieldAccess = ({ req: { user } }) => {
	return isRoleAdmin(user?.role);
};

export const isFieldModerator: FieldAccess = ({ req: { user } }) => {
	return isRoleModerator(user?.role);
};

export const isFieldOfficial: FieldAccess = ({ req: { user } }) => {
	return isRoleOfficial(user?.role);
};

export const isModeratorOrBooker: Access = ({ req: { user } }) => {
	if (isRoleModerator(user?.role)) return true;
	if (user)
		return {
			booker: {
				equals: user.id,
			},
		};
	return false;
};
