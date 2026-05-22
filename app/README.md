# App Routes Workspace

Capital Radar currently renders through static Node scripts into `index.html` and `public/index.html` rather than a framework router.

This folder is reserved for future route/page organization if the project migrates to a component app structure such as Next.js, Vite, or plain React.

Planned routes:

- `/` — market command surface
- `/egg` — macro allocation cycle map
- `/ticker/[ticker]` — ticker workbench
- `/portfolio` — holdings and exposure translation
- `/opportunities` — candidate queue and asymmetry review

Rule: production routes should compose reusable components from `components/`, not paste standalone HTML prototypes.
