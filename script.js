// Notion SDK is included via a CDN link in index.html

// WARNING: Storing API keys directly in client-side JavaScript is insecure and should not be done in production.
// This is for demonstration purposes only. In a real application, use a backend proxy or serverless function.
const NOTION_API_KEY = 'YOUR_NOTION_API_KEY';
const NOTION_DATABASE_ID = 'YOUR_NOTION_DATABASE_ID';

// Initialize Notion client
// const { Client } = require('@notionhq/client'); // This line is for Node.js, adapt for browser
// For browser, the SDK is available globally, e.g. as `Notion.Client` if using unpkg

/**
 * Fetches posts from the Notion database.
 * 
 * Notion Database Structure:
 * To work with this blog, your Notion database should have the following properties:
 * - Title: (Title type) The title of the blog post.
 * - Content: (Rich Text type) The main content of the blog post. // Note: Content is fetched from blocks.
 * - Date: (Date type) The publication date of the blog post.
 * - Slug: (Text type) A URL-friendly version of the title.
 * - Published: (Checkbox type) Whether the post should be displayed.
 */
async function fetchPostsFromNotion() {
    // When using the CDN, the Notion client is available as Notion.Client
    const notion = new Notion.Client({ auth: NOTION_API_KEY });

    try {
        const response = await notion.databases.query({
            database_id: NOTION_DATABASE_ID,
            filter: {
                property: "Published",
                checkbox: {
                    equals: true,
                },
            },
            sorts: [
                {
                    property: "Date",
                    direction: "descending",
                },
            ],
        });
        console.log('Successfully fetched posts from Notion:', response);

        const posts = [];
        for (const page of response.results) {
            try {
                const title = page.properties.Title?.title[0]?.plain_text || 'Untitled';
                const date = page.properties.Date?.date?.start || 'No date';
                const slug = page.properties.Slug?.rich_text[0]?.plain_text || title.toLowerCase().replace(/\s+/g, '-');
                const pageId = page.id;

                // Fetch block children for each page
                const blocksResponse = await notion.blocks.children.list({
                    block_id: pageId,
                });

                let postBody = '';
                for (const block of blocksResponse.results) {
                    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
                        block.paragraph.rich_text.forEach(textElement => {
                            postBody += textElement.plain_text;
                        });
                        postBody += '\n'; // Add a newline between paragraphs
                    }
                    // TODO: Add support for other block types (headings, lists, images, etc.)
                }

                posts.push({
                    title: title,
                    date: date,
                    slug: slug,
                    content: postBody.trim(), // Trim trailing newline
                });
            } catch (e) {
                console.error(`Error processing page ${page.id}:`, e);
                // Optionally skip this post or add a placeholder
            }
        }
        renderPosts(posts);

    } catch (error) {
        console.error('Error fetching posts from Notion:', error);
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.innerHTML = '<p style="color:red;">Error loading posts. Check the console for details. Make sure your API Key and Database ID are correct and the Notion integration has access to the database.</p>';
        }
    }
}

/**
 * Renders an array of post objects into the <main> element.
 * @param {Array<Object>} posts - Array of post objects.
 */
function renderPosts(posts) {
    const mainElement = document.querySelector('main');
    if (!mainElement) {
        console.error('Main element not found in HTML.');
        return;
    }

    mainElement.innerHTML = ''; // Clear existing content

    if (posts.length === 0) {
        mainElement.innerHTML = '<p>No published posts found.</p>';
        return;
    }

    posts.forEach(post => {
        const article = document.createElement('article');
        
        const titleElement = document.createElement('h2');
        titleElement.textContent = post.title;
        article.appendChild(titleElement);

        const dateElement = document.createElement('p');
        dateElement.className = 'date'; // For potential styling
        dateElement.textContent = `Published on: ${post.date}`;
        article.appendChild(dateElement);
        
        // Optionally, add slug as a data attribute or a hidden link for permalinks
        // article.dataset.slug = post.slug;

        const contentElement = document.createElement('div');
        contentElement.className = 'post-content';
        // Simple text content rendering. For HTML content, use .innerHTML carefully
        // and ensure content is sanitized if it comes from untrusted sources.
        // Here, we are concatenating plain_text, so textContent is safer.
        // To render newlines from postBody as <br>, we can split and append:
        post.content.split('\n').forEach((paragraphText, index) => {
            if (paragraphText) {
                const p = document.createElement('p');
                p.textContent = paragraphText;
                contentElement.appendChild(p);
            }
        });
        article.appendChild(contentElement);

        mainElement.appendChild(article);
    });
}

// Call fetchPostsFromNotion when the script loads.
// Using DOMContentLoaded to ensure the <main> element is available.
document.addEventListener('DOMContentLoaded', () => {
    fetchPostsFromNotion();
});

console.log("script.js loaded. fetchPostsFromNotion() will be called on DOMContentLoaded. Ensure NOTION_API_KEY and NOTION_DATABASE_ID are set correctly.");
