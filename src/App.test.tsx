import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { MemoryRouter } from 'react-router';
import React from 'react';

// Simple test component for initial setup verification
const TestComponent = (): React.ReactElement => {
  return React.createElement('div', null, 'Test Component');
};

describe('App Setup', () => {
  it('renders test component', () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(TestComponent)
      )
    );

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });
});
