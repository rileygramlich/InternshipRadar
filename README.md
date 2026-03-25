# AI Internship Advisor & Application Tracker (Internship Radar)

### COMP 2633 – Mini Hackathon 2

---

# 1. Problem Statement

Mount Royal University (MRU) computing students face significant challenges in discovering and managing internship opportunities. Relevant postings are scattered across multiple platforms such as company career pages, job boards, and external sites, requiring students to manually search each source. This process is time-consuming, inconsistent, and often leads to missed opportunities.

Additionally, students lack a centralized system to track their applications, resulting in confusion about which roles they have applied to and their current status in the hiring process.

This problem exists due to the fragmented nature of job postings and the absence of a unified tool tailored specifically for student workflows.

The proposed system, **Internship Radar**, addresses this problem by automatically aggregating internship opportunities, evaluating their relevance using a student profile, sending alerts via Discord, and providing a dashboard to track applications. This reduces manual effort, increases visibility of opportunities, and improves organization during the internship search process.

---

# 2. Functional Requirements

- The system shall allow users to create and manage a personal profile including skills, location, and interests.
- The system shall aggregate internship postings from multiple configured sources.
- The system shall evaluate internship postings and assign a relevance score based on the user's profile.
- The system shall send Discord notifications when a high-relevance internship is identified.
- The system shall store internship postings in a centralized database.
- The system shall allow users to track application status (Saved, Applied, Interview, Rejected, Offer).
- The system shall display internship postings and match scores in a graphical dashboard.
- The system shall generate a weekly summary report of internship activity and application progress.

---

# 3. Non-Functional Requirements

- The system shall process and display newly discovered internship postings within **5 minutes** of detection.
- The system shall support usage through modern web browsers (Chrome, Edge, Firefox) with no additional installation required.
- The system shall provide a user interface that allows first-year computing students to complete core tasks (view jobs, update status) within **2 minutes** without prior training.
- The system shall maintain **at least 95% accuracy** in duplicate detection of internship postings.
- The system shall handle at least **100 concurrent job postings per scan cycle** without failure.

---

# 4. MoSCoW Prioritization

## Must-Have

- User profile creation and management
- Internship source aggregation
- Job filtering and scoring system
- Discord alert system
- Application tracking system
- Dashboard displaying internship listings

## Should-Have

- Weekly internship summary report
- Duplicate detection system
- Job tagging (frontend, backend, AI, etc.)
- Filtering options (location, remote, role type)

## Could-Have

- AI-generated skill gap recommendations
- Personalized job ranking improvements over time
- UI themes or customization options

---

# 5. T-Shirt Sizing (Effort Estimation)

| Feature                              | Size   |
| ------------------------------------ | ------ |
| User profile creation                | Small  |
| Internship ingestion (single source) | Medium |
| Multi-source aggregation             | Large  |
| Job scoring system                   | Medium |
| Discord alert integration            | Small  |
| Application tracking system          | Medium |
| Dashboard UI                         | Large  |
| Weekly report generation             | Medium |

---

# 6. Stakeholder Feedback

Feedback was gathered from potential users including computing students, instructors, and career services staff.

## Instructor Feedback

> “Great idea, because co-op students often need more tools to find opportunities.”

This feedback reinforced that the project addresses a real student need and is appropriate in scope for the hackathon.

---

## Career Services Inquiry

**Question:**  
What challenges do students face when searching for internships?

**Response:**  
“Students often rely on multiple job platforms and don’t always know where to look. Many miss opportunities because they don’t check frequently enough or aren’t aware of all the sources available.”

---

**Question:**  
Do students struggle with tracking their applications?

**Response:**  
“Yes, many students do not have a structured way to track applications. They often forget where they applied or what stage they are in.”

---

## Impact on Design

Based on this feedback, the system was designed to:

- centralize internship discovery
- automate job scanning
- provide real-time notifications
- include a built-in application tracker

This ensures the system directly addresses real user frustrations.

---

# 7. Architecture Decision

The system uses a **Layered MVC Architecture combined with Event-Driven Workflows**.

## Architecture Style

- **MVC (Model–View–Controller)** for the main application
- **Event-driven architecture** for automation workflows

## Justification

MVC allows clear separation between:

- data (models)
- user interface (views)
- application logic (controllers)

This improves maintainability and scalability.

Event-driven workflows (via n8n) enable:

- automated job scanning
- asynchronous processing
- real-time notifications

This hybrid approach allows the system to handle both interactive user operations and background automation efficiently.

---

## Technology Stack

- **Frontend:** React / Next.js
- **Backend:** Node.js with Express
- **Automation:** n8n
- **Database:** Supabase (PostgreSQL)
- **AI Layer:** OpenAI API (for explanations and recommendations)
- **Notifications:** Discord Webhooks

---

# 8. Tools and Training Plan

## Tools

- **Programming Languages:** JavaScript / TypeScript
- **Frontend Framework:** React / Next.js
- **Backend Framework:** Express.js
- **Automation Tool:** n8n
- **Database:** Supabase
- **Version Control:** Git and GitHub

---

## Team Familiarity

- Most team members are familiar with JavaScript and basic web development.
- Some team members have experience with React and Git.
- Limited experience with n8n and Supabase may require initial setup learning.

---

## Training Plan

### Week 1

- Learn basics of n8n workflows
- Review Supabase setup and database structure
- Assign roles based on familiarity

### Week 2

- Continue learning advanced n8n integrations
- Practice API integration (Discord, OpenAI)

Training will continue alongside development as needed.

---
