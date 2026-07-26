// Which kind of JWT this is.
export const JWT_TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
};

// Whose token it is — kept separate from JWT_TOKEN_TYPE so a single claim
// never has to mean two different things at once.
export const JWT_PRINCIPAL = {
  USER: 'user',
  ADMIN: 'admin',
};
