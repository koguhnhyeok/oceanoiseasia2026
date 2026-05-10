# Oceanoise Asia 2026

International Symposium on Underwater Noise in Asia
**October 11–13, 2026 · ARA Convention Hall, Jeju, Korea**

Conference Chair: **Dong-Guk Paeng**

This repository hosts the official preview website for Oceanoise Asia 2026.

## Important Dates

| Event | Date |
|---|---|
| Paper Submission Opens | May 10, 2026 |
| Abstract Submission Deadline | July 10, 2026 |
| Author Notification | August 10, 2026 |
| Online Registration | August 11 – September 30, 2026 |
| Conference Dates | October 11 – 13, 2026 |

## Pages

- **Home** — `index.html` (news, welcome message + poster, important dates, call for papers CTA)
- **Call for Papers** — `call-for-papers.html` (themes, formatting guidelines, downloadable template, submitter's declaration)
- **Committees** — `committees.html` (chair, secretary, international + local committees)
- Venue / Registration — coming soon
- Contact — in the footer of every page

## Submission

Abstracts are submitted by email to **oceanoiseasia2026@gmail.com** using the official Word template available on the Call for Papers page.

## Project Structure

```
.
├── index.html                    # Home page
├── call-for-papers.html          # Call for Papers + formatting guidelines
├── committees.html               # Organizing committees
├── poster.jpg                    # Call for Papers poster
├── assets/
│   ├── css/
│   │   └── site.css              # Shared styles
│   └── downloads/
│       ├── Abstract_Template.docx
│       ├── Abstract_Submission_Guidelines.docx
│       └── Oceanoise_Asia_2026_Invitation.pdf
├── CNAME
└── README.md
```

## Local Preview

Open `index.html` directly in any modern browser, or serve the directory:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Hosting

Static site deployed via GitHub Pages.

## Contact

- General inquiries / abstract submission: **oceanoiseasia2026@gmail.com**
- Conference Chair: Dong-Guk Paeng (Jeju National University)
- General Secretary: Changsoo Kim (Jeju National University)
