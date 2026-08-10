/**
 * Stand-ins for values a real backend will own. Nothing else in the app
 * should need to change when each of these is replaced by a real API call —
 * only the store/service noted in each comment.
 */
export const MOCK_CONFIG = {
  defaultDocTemplates: {
    agreement: 'Plexo_Representative_Agreement_Blank.pdf',
    w4: 'IRS_W4_Blank.pdf',
  }, // document-template-store.ts
  portalDomain: 'plexopro.com', 
  sessionStorageKeys: {
    rep: 'plexo.rep.session',
    admin: 'plexo.admin.session',
  }, // auth.ts, admin-auth.ts
} as const;
