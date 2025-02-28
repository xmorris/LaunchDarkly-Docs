const { queries } = require('./src/utils/algolia')

const isStaging = process.env.GATSBY_ACTIVE_ENV === 'staging'
const isProd = process.env.GATSBY_ACTIVE_ENV === 'production'

// These are useful to debug build issues
console.log(`
  GATSBY_ACTIVE_ENV=${process.env.GATSBY_ACTIVE_ENV}
  PR_NUMBER=${process.env.PR_NUMBER}
  GATSBY_ALGOLIA_INDEX=${process.env.GATSBY_ALGOLIA_INDEX}
  GATSBY_ALGOLIA_APP_ID=${process.env.GATSBY_ALGOLIA_APP_ID}
`)

const plugins = [
  {
    resolve: 'gatsby-plugin-mdx',
    options: {
      remarkPlugins: [require('remark-slug'), require('remark-unwrap-images')],
      gatsbyRemarkPlugins: [
        {
          resolve: 'gatsby-remark-relative-images',
        },
        {
          resolve: 'gatsby-remark-images',
          options: {
            maxWidth: 640,
            showCaptions: true,
          },
        },
        'gatsby-remark-copy-linked-files',
      ],
    },
  },
  'gatsby-plugin-theme-ui',
  'gatsby-plugin-react-helmet',
  'gatsby-plugin-typescript',
  'gatsby-transformer-json',
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      name: 'navigationData',
      path: `${__dirname}/src/content/navigationData.json`,
    },
  },
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      name: 'rootTopics',
      path: `${__dirname}/autoGeneratedData/rootTopics.json`,
    },
  },
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      name: 'secondLevelTopics',
      path: `${__dirname}/autoGeneratedData/secondLevelTopics.json`,
    },
  },
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      name: 'images',
      path: `${__dirname}/assets/images`,
    },
  },
  {
    resolve: 'gatsby-plugin-svgr-loader',
    options: {
      rule: {
        options: {
          svgoConfig: {
            plugins: [
              { name: 'removeAttrs', params: { attrs: ['fill', 'path:fill'] } },
              {
                name: 'removeViewBox',
                active: false,
              },
              {
                name: 'removeDimensions',
                active: true,
              },
            ],
          },
        },
        include: /icons/,
      },
    },
  },
  'gatsby-transformer-sharp',
  'gatsby-plugin-sharp',
  'gatsby-plugin-catch-links',
  {
    resolve: 'gatsby-plugin-manifest',
    options: {
      name: 'LaunchDarkly Docs',
      short_name: 'LD Docs',
      start_url: '/',
      background_color: '#0E1932',
      theme_color: '#FFF',
      display: 'minimal-ui',
      icon: 'assets/images/favicon-osmo.png', // This path is relative to the root of the site.
    },
  },
  {
    resolve: 'gatsby-plugin-google-gtag',
    options: {
      trackingIds: ['UA-44750782-3', 'G-P12DWV2SBZ'],
      pluginConfig: {
        head: true,
      },
    },
  },
  {
    resolve: 'gatsby-plugin-launchdarkly',
    options: {
      clientSideID: process.env.LAUNCHDARKLY_CLIENT_SIDE_ID,
      options: {
        baseUrl: 'https://sdk.ld.catamorphic.com',
        streamUrl: 'https://stream.ld.catamorphic.com',
        eventsUrl: 'https://events.ld.catamorphic.com',
        bootstrap: 'localstorage',
      },
    },
  },
]

// Omit mdx images in fast dev mode
if (process.env.DEV_FAST !== 'true') {
  plugins.push(
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'mdx-images',
        path: `${__dirname}/src/content/images`,
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: `${__dirname}/src/content/topics`,
        name: 'mdx',
      },
    },
  )
} else {
  plugins.push({
    resolve: 'gatsby-source-filesystem',
    options: {
      path: `${__dirname}/src/content/topics`,
      name: 'mdx',
      // Omit all mdx but getting-started, managing-flags, managing-users in fast dev mode
      ignore: [
        '**/guides',
        '**/integrations',
        '**/sdk',
        '**/home/account-security',
        '**/home/advanced',
        '**/home/experimentation',
        '**/home/metrics-and-insights',
      ],
    },
  })
}

if (isStaging || isProd) {
  plugins.push(
    {
      // Only build algolia indexes in staging and production
      resolve: 'gatsby-plugin-algolia',
      options: {
        appId: process.env.GATSBY_ALGOLIA_APP_ID,
        apiKey: process.env.ALGOLIA_ADMIN_KEY,
        queries,
        chunkSize: 10000, // default: 1000
        continueOnFailure: isStaging,
        enablePartialUpdates: true,
      },
    },
    {
      resolve: 'gatsby-plugin-s3',
      options: {
        bucketName: process.env.AWS_S3_BUCKET,
        bucketPrefix: process.env.PR_NUMBER,
        protocol: 'https',
        hostname: process.env.AWS_HOSTNAME,
        generateRedirectObjectsForPermanentRedirects: true,
        generateIndexPageForRedirect: isProd, // this is on by default, but should should be off in staging
        enableS3StaticWebsiteHosting: false,
      },
    },
  )
}

if (isProd) {
  plugins.push(
    {
      //https://www.gatsbyjs.org/packages/gatsby-plugin-segment-js/
      resolve: 'gatsby-plugin-segment-js',
      options: {
        prodKey: process.env.SEGMENT_KEY,
        //track pageviews when there is a route change. Calls window.analytics.page() on each route change.
        trackPage: true,
        delayLoad: false,
      },
    },
    {
      resolve: 'gatsby-plugin-sitemap',
      options: {
        excludes: ['/systemLayout/', '/components'],
      },
    },
  )
}

if (!isProd) {
  // GOTCHA: On dev and staging, the client side redirect plugin auto-generates index.html files
  // which acts as default pages which contains scripts to enforce redirects defined in
  // gatsby-node.js. Production doesn't need this because gatsby-plugin-s3 does this for us
  // automatically
  // Re:staging - the s3 plugin doesn't properly generate redirects when using bucketPrefix
  // Track issue here: https://github.com/jariz/gatsby-plugin-s3/issues/24
  plugins.push('gatsby-plugin-client-side-redirect')
}

// Push pr branches to a subfolder in the staging bucket using the pr number as routes.
// For example, a pr number 58 will be previewable on:
// https://docs-stg.launchdarkly.com/58
module.exports = {
  pathPrefix: isStaging ? `/${process.env.PR_NUMBER}` : '/',
  siteMetadata: {
    title: 'LaunchDarkly Docs',
    description: 'LaunchDarkly documentation',
    author: '@launchdarkly',
    siteUrl: 'https://docs.launchdarkly.com',
  },
  plugins,
}
