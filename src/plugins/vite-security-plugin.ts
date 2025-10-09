/**
 * Vite plugin for security headers and CSP injection
 */

import type { Plugin } from 'vite';
import { getSecurityConfig, getSecurityHeaders } from '../config/security';

export interface SecurityPluginOptions {
  enabled?: boolean;
  injectCSP?: boolean;
  injectSecurityHeaders?: boolean;
}

/**
 * Vite plugin to inject security headers and CSP
 */
export function securityPlugin(options: SecurityPluginOptions = {}): Plugin {
  const {
    enabled = true,
    injectCSP = true,
    injectSecurityHeaders = true,
  } = options;

  if (!enabled) {
    return {
      name: 'security-plugin-disabled',
    };
  }

  const securityConfig = getSecurityConfig();
  const securityHeaders = getSecurityHeaders(securityConfig);

  return {
    name: 'security-plugin',
    configureServer(server) {
      // Add security headers to development server
      server.middlewares.use((_req, res, next) => {
        if (injectSecurityHeaders) {
          Object.entries(securityHeaders).forEach(([name, value]) => {
            res.setHeader(name, value);
          });
        }
        next();
      });
    },
    transformIndexHtml(html: string) {
      if (!injectCSP || !securityConfig.csp.enabled) {
        return html;
      }

      // Inject CSP meta tag
      const cspHeaderName = securityConfig.csp.reportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy';
      
      const cspContent = Object.entries(securityConfig.csp.directives)
        .filter(([, sources]) => sources !== undefined)
        .map(([directive, sources]) => `${directive} ${sources!.join(' ')}`)
        .join('; ');

      const cspMetaTag = `<meta http-equiv="${cspHeaderName}" content="${cspContent}">`;
      
      // Inject security meta tags in head
      const securityMetaTags = [
        cspMetaTag,
        '<meta name="referrer" content="strict-origin-when-cross-origin">',
        '<meta name="format-detection" content="telephone=no">',
      ].join('\n    ');

      // Insert after existing meta tags or at the beginning of head
      const headMatch = html.match(/<head[^>]*>/i);
      if (headMatch) {
        const insertPosition = headMatch.index! + headMatch[0].length;
        return html.slice(0, insertPosition) + 
               '\n    ' + securityMetaTags + 
               html.slice(insertPosition);
      }

      return html;
    },
    generateBundle(options) {
      // Add security headers to build output
      if (injectSecurityHeaders && options.format === 'es') {
        // Create a security headers file for deployment
        const headersContent = Object.entries(securityHeaders)
          .map(([name, value]) => `${name}: ${value}`)
          .join('\n');

        this.emitFile({
          type: 'asset',
          fileName: '_headers',
          source: `/*\n${headersContent}`,
        });

        // Create Netlify-style headers file
        this.emitFile({
          type: 'asset',
          fileName: '_headers.netlify',
          source: `/*\n  ${Object.entries(securityHeaders)
            .map(([name, value]) => `${name}: ${value}`)
            .join('\n  ')}`,
        });

        // Create Vercel-style headers file
        const vercelConfig = {
          headers: [
            {
              source: '/(.*)',
              headers: Object.entries(securityHeaders).map(([key, value]) => ({
                key,
                value,
              })),
            },
          ],
        };

        this.emitFile({
          type: 'asset',
          fileName: 'vercel.json',
          source: JSON.stringify(vercelConfig, null, 2),
        });
      }
    },
  };
}

/**
 * Create nonce for inline scripts (for advanced CSP)
 */
export function createNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

/**
 * Inject nonce into script tags
 */
export function injectNonce(html: string, nonce: string): string {
  return html.replace(
    /<script(?![^>]*\bnonce\b)([^>]*)>/gi,
    `<script nonce="${nonce}"$1>`
  );
}

/**
 * Security plugin with nonce support
 */
export function securityPluginWithNonce(options: SecurityPluginOptions = {}): Plugin {
  const basePlugin = securityPlugin(options);
  
  return {
    ...basePlugin,
    name: 'security-plugin-with-nonce',
    transformIndexHtml(html: string) {
      // Generate nonce for this request
      const nonce = createNonce();
      
      // Apply base transform
      let transformedHtml = html;
      if (basePlugin.transformIndexHtml && typeof basePlugin.transformIndexHtml === 'function') {
        // Skip base plugin transformation for now to avoid type issues
        transformedHtml = html;
      }
      
      // Inject nonce into script tags
      transformedHtml = injectNonce(transformedHtml, nonce);
      
      // Update CSP to include nonce
      const securityConfig = getSecurityConfig();
      if (securityConfig.csp.enabled) {
        const scriptSrcWithNonce = [
          ...securityConfig.csp.directives['script-src'] || [],
          `'nonce-${nonce}'`,
        ];
        
        const updatedDirectives = {
          ...securityConfig.csp.directives,
          'script-src': scriptSrcWithNonce,
        };
        
        const cspContent = Object.entries(updatedDirectives)
          .filter(([, sources]) => sources !== undefined)
          .map(([directive, sources]) => `${directive} ${sources!.join(' ')}`)
          .join('; ');
        
        // Replace CSP meta tag with nonce-enabled version
        const cspHeaderName = securityConfig.csp.reportOnly 
          ? 'Content-Security-Policy-Report-Only' 
          : 'Content-Security-Policy';
        
        transformedHtml = transformedHtml.replace(
          new RegExp(`<meta http-equiv="${cspHeaderName}" content="[^"]*">`, 'i'),
          `<meta http-equiv="${cspHeaderName}" content="${cspContent}">`
        );
      }
      
      return transformedHtml;
    },
  };
}