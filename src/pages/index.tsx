import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader(): ReactNode {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          WireManager
        </Heading>

        <p className="hero__subtitle">
          WireGuard access management made simple.
        </p>

        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/installation">
            Get Started →
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="WireManager Documentation"
      description="Documentation for WireManager">
      <HomepageHeader />
    </Layout>
  );
}