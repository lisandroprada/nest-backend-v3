declare namespace Express {
  interface Request {
    user: { id: string; roles: string[] };
  }
}
