/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'Dify Workflow Frontend' },
  { name: 'description', content: 'Welcome to Dify Workflow Frontend!' },
];

export default function Index(): React.ReactElement {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <h1>Welcome to Dify Workflow Frontend</h1>
      <p>This is the main dashboard page.</p>
    </div>
  );
}
