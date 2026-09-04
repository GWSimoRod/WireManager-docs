import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'WireManager',
  tagline: 'WireGuard access management made simple',
  favicon: 'img/favicon.ico',

  url: 'https://gwsimorod.github.io',
  baseUrl: '/WireManager-docs/',

  organizationName: 'GWSimoRod',
  projectName: 'WireManager-docs',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
    mermaid: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/GWSimoRod/WireManager-docs/tree/main/',
        },

        blog: false,

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    navbar: {
      title: 'WireManager',
      logo: {
        alt: 'WireManager Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/GWSimoRod/WireManager',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Concepts',
              to: '/docs/concepts/overview',
            },
            {
              label: 'API',
              to: '/docs/api/overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/GWSimoRod/WireManager',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} WireManager`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;