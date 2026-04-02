import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const issuesFilePath = path.join(__dirname, 'issues/enhancement-and-polish.json');
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function main() {
    // Read issues from the JSON file
    const data = JSON.parse(fs.readFileSync(issuesFilePath, 'utf-8'));

    for (const issue of data) {
        const { title, body, labels } = issue;

        // Check if an issue with the same title already exists
        const existingIssue = await checkExistingIssue(title);
        if (existingIssue) {
            console.log(`Issue with title '${title}' already exists. Skipping creation.`);
            continue;
        }

        // Ensure labels exist
        await ensureLabelsExist(labels);

        // Create the issue
        await createIssue(title, body, labels);
    }
}

async function checkExistingIssue(title) {
    const response = await fetch(`${GITHUB_API_URL}/repos/rileygramlich/InternshipRadar/issues`, {
        method: 'GET',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    const issues = await response.json();
    return issues.find(issue => issue.title === title);
}

async function ensureLabelsExist(labels) {
    const response = await fetch(`${GITHUB_API_URL}/repos/rileygramlich/InternshipRadar/labels`, {
        method: 'GET',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    const existingLabels = await response.json();
    const existingLabelNames = existingLabels.map(label => label.name);

    for (const label of labels) {
        if (!existingLabelNames.includes(label)) {
            console.log(`Label '${label}' does not exist. Consider creating it first.`);
        }
    }
}

async function createIssue(title, body, labels) {
    const response = await fetch(`${GITHUB_API_URL}/repos/rileygramlich/InternshipRadar/issues`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, body, labels })
    });

    if (!response.ok) {
        console.error('Failed to create issue:', response.statusText);
        return;
    }

    const createdIssue = await response.json();
    console.log(`Created issue: ${createdIssue.html_url}`);
}

main().catch(console.error);