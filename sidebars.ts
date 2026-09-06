import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/configuration',
        'getting-started/first-step',
      ],
    },

    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/overview',
        'concepts/peers',
        'concepts/tags',
        'concepts/services',
        'concepts/access-policies',
        'concepts/external-auth',
      ],
    },

    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/create-peer',
        'guides/configure-access',
        'guides/nginx-proxy-manager',
        'guides/user-management',
      ],
    },

    {
      type: 'category',
      label: 'API',
      items: [
        'api/overview',
        'api/setup',
        'api/authentication',
        'api/peers',
        'api/servers',
        'api/policies',
        'api/reference',
      ],
    },

    {
      type: 'category',
      label: 'Development',
      items: [
        'development/architecture',
        'development/contributing',
      ],
    },
  ],
};

export default sidebars;