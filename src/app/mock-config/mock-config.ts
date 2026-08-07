/**
 * Stand-ins for values a real backend will own. Nothing else in the app
 * should need to change when each of these is replaced by a real API call —
 * only the store/service noted in each comment.
 */
export const MOCK_CONFIG = {
  // Mirrors UsersController's dummy DummyEmail/DummyRepId on the backend — prefilled so both
  // login tabs demo cleanly against api/users/validate without typing them in. login.ts
  demoLoginCredentials: { email: 'sakthi@plexo.com', repId: '1000' },
  defaultDocTemplates: {
    agreement: 'Plexo_Representative_Agreement_Blank.pdf',
    w4: 'IRS_W4_Blank.pdf',
  }, // document-template-store.ts
  portalDomain: 'plexopro.com', // rep-directory-store.ts (portalLink)
  sessionStorageKeys: {
    rep: 'plexo.rep.session',
    admin: 'plexo.admin.session',
  }, // auth.ts, admin-auth.ts
} as const;
