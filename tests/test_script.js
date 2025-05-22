// --- Basic Test Runner Logic ---
const testResultsDiv = document.getElementById('test-results');
let testsRun = 0;
let testsPassed = 0;

function logResult(message, passed) {
    const p = document.createElement('p');
    p.textContent = message;
    p.className = passed ? 'pass' : 'fail';
    testResultsDiv.appendChild(p);
}

function assertEquals(expected, actual, message) {
    testsRun++;
    if (JSON.stringify(expected) === JSON.stringify(actual)) { // Simple stringify for deep comparison
        testsPassed++;
        logResult(`PASS: ${message}`, true);
        return true;
    } else {
        logResult(`FAIL: ${message}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`, false);
        return false;
    }
}

function assertTruthy(actual, message) {
    testsRun++;
    if (actual) {
        testsPassed++;
        logResult(`PASS: ${message}`, true);
        return true;
    } else {
        logResult(`FAIL: ${message}. Expected truthy, got ${actual}`, false);
        return false;
    }
}

function assertElementCount(selector, expectedCount, message) {
    testsRun++;
    const elements = document.querySelectorAll(selector);
    if (elements.length === expectedCount) {
        testsPassed++;
        logResult(`PASS: ${message}`, true);
        return true;
    } else {
        logResult(`FAIL: ${message}. Expected ${expectedCount} elements for selector "${selector}", found ${elements.length}.`, false);
        return false;
    }
}

function assertTextContent(selector, expectedText, message) {
    testsRun++;
    const element = document.querySelector(selector);
    if (element && element.textContent.trim() === expectedText.trim()) {
        testsPassed++;
        logResult(`PASS: ${message}`, true);
        return true;
    } else {
        const actualText = element ? element.textContent.trim() : "Element not found";
        logResult(`FAIL: ${message}. Expected text "${expectedText}" for selector "${selector}", found "${actualText}".`, false);
        return false;
    }
}

// --- Mock Notion API ---
let mockQueryResponse = { results: [] };
let mockBlocksResponse = {}; // Keyed by block_id (page_id)

// Store original Notion client if it exists, to restore later if needed (though for this script, we just override)
const originalNotionClient = window.Notion ? window.Notion.Client : undefined;

window.Notion = {
    Client: function(options) {
        // Optionally, you could check options.auth here if needed for tests
        console.log('Mock Notion.Client instantiated with options:', options);
        return {
            databases: {
                query: async (args) => {
                    console.log('Mocked notion.databases.query called with:', args);
                    // Simulate a delay, like a real API call
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                    if (typeof mockQueryResponse === 'function') {
                        return mockQueryResponse(args);
                    }
                    return mockQueryResponse;
                }
            },
            blocks: {
                children: {
                    list: async (args) => {
                        console.log('Mocked notion.blocks.children.list called with:', args);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        if (mockBlocksResponse[args.block_id]) {
                            return mockBlocksResponse[args.block_id];
                        }
                        return { results: [] }; // Default empty response
                    }
                }
            }
        };
    }
};

// --- Test Definitions ---

// Keep track of original renderPosts to test it in isolation
const originalRenderPosts = window.renderPosts;
let capturedPostsForRender = null;

async function testFetchPostsFromNotion() {
    console.log("--- Running testFetchPostsFromNotion ---");
    const mainElement = document.querySelector('main');
    mainElement.innerHTML = ''; // Clear main for the test

    // Override renderPosts to capture its input
    window.renderPosts = (posts) => {
        console.log('Mocked renderPosts called with:', posts);
        capturedPostsForRender = posts;
        // Call original renderPosts to still see output if desired, or skip to isolate fetch
        // originalRenderPosts(posts); 
    };

    // --- Test Case 1: Basic published post ---
    mockQueryResponse = {
        results: [
            { 
                id: "page1", 
                properties: {
                    Title: { title: [{ plain_text: "Test Post 1" }] },
                    Date: { date: { start: "2023-01-01" } },
                    Slug: { rich_text: [{ plain_text: "test-post-1" }] },
                    Published: { checkbox: true }
                }
            }
        ]
    };
    mockBlocksResponse = {
        "page1": { 
            results: [
                { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Content for post 1." }] } }
            ]
        }
    };
    
    await window.fetchPostsFromNotion(); // Ensure this is the global one from script.js

    assertEquals(1, capturedPostsForRender.length, "fetchPosts: Should process 1 published post.");
    if (capturedPostsForRender.length === 1) {
        assertEquals("Test Post 1", capturedPostsForRender[0].title, "fetchPosts: Post 1 title is correct.");
        assertEquals("2023-01-01", capturedPostsForRender[0].date, "fetchPosts: Post 1 date is correct.");
        assertEquals("test-post-1", capturedPostsForRender[0].slug, "fetchPosts: Post 1 slug is correct.");
        assertEquals("Content for post 1.", capturedPostsForRender[0].content, "fetchPosts: Post 1 content is correct.");
    }

    // --- Test Case 2: Unpublished post ---
    mockQueryResponse = {
        results: [
            { id: "page2", properties: { Title: { title: [{ plain_text: "Unpublished Post" }]}, Published: { checkbox: false } } },
            { 
                id: "page3", 
                properties: {
                    Title: { title: [{ plain_text: "Test Post 3" }] },
                    Date: { date: { start: "2023-01-03" } },
                    Slug: { rich_text: [{ plain_text: "test-post-3" }] },
                    Published: { checkbox: true }
                }
            }
        ]
    };
    mockBlocksResponse = { // Only need blocks for published posts
        "page3": { results: [{ type: "paragraph", paragraph: { rich_text: [{ plain_text: "Content for post 3." }] } }] }
    };

    await window.fetchPostsFromNotion();
    assertEquals(1, capturedPostsForRender.length, "fetchPosts: Should filter out unpublished posts.");
    if (capturedPostsForRender.length === 1) {
        assertEquals("Test Post 3", capturedPostsForRender[0].title, "fetchPosts: Correct post (Post 3) processed after filtering.");
    }

    // --- Test Case 3: Multiple paragraphs ---
     mockQueryResponse = {
        results: [
            { 
                id: "page4", 
                properties: {
                    Title: { title: [{ plain_text: "Multi-Para Post" }] },
                    Date: { date: { start: "2023-01-04" } },
                    Slug: { rich_text: [{ plain_text: "multi-para-post" }] },
                    Published: { checkbox: true }
                }
            }
        ]
    };
    mockBlocksResponse = {
        "page4": { 
            results: [
                { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Paragraph 1." }] } },
                { type: "paragraph", paragraph: { rich_text: [{ plain_text: "Paragraph 2." }] } }
            ]
        }
    };
    await window.fetchPostsFromNotion();
    assertEquals(1, capturedPostsForRender.length, "fetchPosts: Multi-paragraph post processed.");
    if (capturedPostsForRender.length === 1) {
        assertEquals("Paragraph 1.\nParagraph 2.", capturedPostsForRender[0].content, "fetchPosts: Content from multiple paragraphs is concatenated with newlines.");
    }
    
    // Restore original renderPosts if other tests need it unmocked, or if script.js relies on it
    window.renderPosts = originalRenderPosts; 
}

function testRenderPosts() {
    console.log("--- Running testRenderPosts ---");
    const mainElement = document.querySelector('main');

    // --- Test Case 1: Render multiple posts ---
    const postsToRender = [
        { title: "Render Test 1", date: "2023-02-01", slug: "render-1", content: "Content for render 1.\nSecond para." },
        { title: "Render Test 2", date: "2023-02-02", slug: "render-2", content: "Content for render 2." }
    ];
    originalRenderPosts(postsToRender); // Use original renderPosts

    assertElementCount("main article", 2, "renderPosts: Should render 2 articles.");
    assertTextContent("main article:nth-child(1) h2", "Render Test 1", "renderPosts: Post 1 title rendered correctly.");
    assertTextContent("main article:nth-child(1) p.date", "Published on: 2023-02-01", "renderPosts: Post 1 date rendered correctly.");
    assertElementCount("main article:nth-child(1) .post-content p", 2, "renderPosts: Post 1 content has 2 paragraphs.");
    assertTextContent("main article:nth-child(1) .post-content p:nth-child(1)", "Content for render 1.", "renderPosts: Post 1, Para 1 rendered correctly.");
    assertTextContent("main article:nth-child(1) .post-content p:nth-child(2)", "Second para.", "renderPosts: Post 1, Para 2 rendered correctly.");
    assertTextContent("main article:nth-child(2) h2", "Render Test 2", "renderPosts: Post 2 title rendered correctly.");
    assertElementCount("main article:nth-child(2) .post-content p", 1, "renderPosts: Post 2 content has 1 paragraph.");


    // --- Test Case 2: Render empty array ---
    originalRenderPosts([]);
    assertElementCount("main article", 0, "renderPosts: No articles should be rendered for empty input.");
    assertTextContent("main p", "No published posts found.", "renderPosts: 'No published posts' message shown for empty input.");

    // --- Test Case 3: Post with no content ---
    const postWithNoContent = [
        { title: "No Content Post", date: "2023-02-03", slug: "no-content", content: "" }
    ];
    originalRenderPosts(postWithNoContent);
    assertElementCount("main article", 1, "renderPosts: Article rendered for post with no content.");
    assertTextContent("main article h2", "No Content Post", "renderPosts: Title correct for no-content post.");
    assertElementCount("main article .post-content p", 0, "renderPosts: No paragraph tags if content is empty string.");

    mainElement.innerHTML = ''; // Clean up
}


// --- Run Tests ---
async function runAllTests() {
    // Ensure script.js's DOMContentLoaded fetch does not interfere or use it to our advantage
    // For now, we assume script.js's fetch might run, but our mocks will control its behavior.
    
    // It's important that fetchPostsFromNotion is available globally from script.js
    if (typeof window.fetchPostsFromNotion !== 'function') {
        logResult("FAIL: CRITICAL - fetchPostsFromNotion function not found globally. script.js might not be loaded correctly or function is not global.", false);
        return;
    }
     if (typeof window.renderPosts !== 'function') {
        logResult("FAIL: CRITICAL - renderPosts function not found globally. script.js might not be loaded correctly or function is not global.", false);
        return;
    }

    await testFetchPostsFromNotion();
    testRenderPosts(); // This is synchronous

    // Summary
    const summary = document.createElement('h3');
    summary.textContent = `Tests completed: ${testsRun} run, ${testsPassed} passed, ${testsRun - testsPassed} failed.`;
    testResultsDiv.appendChild(summary);

    // Restore Notion Client if it was originally defined (optional, mainly for cleanup if page was interactive)
    // if (originalNotionClient) window.Notion.Client = originalNotionClient;
}

document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to ensure script.js's own DOMContentLoaded (if any) has fired.
    // And to ensure the page elements are fully ready.
    setTimeout(runAllTests, 100); 
});
