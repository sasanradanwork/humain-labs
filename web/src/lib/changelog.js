// The log behind the status page. Add a line here when something ships or is planned,
// newest first. Dates are ISO so they sort and format on their own.

export const SHIPPED = [
  {
    date: "2026-11-07",
    title: "Status page, and social links in the footer",
    body: "This page. It checks the API live each time you open it, and lists what has shipped and what is coming. LinkedIn and X links added to the footer, along with cookie settings.",
  },
  {
    date: "2026-11-06",
    title: "Study budgets and a cost breakdown",
    body: "Researchers now set a budget when posting a study. The platform fee comes off, and what is left is split between the places they want to fill. The breakdown updates as they type, and the manage page tracks what has been committed and what would be refunded.",
  },
  {
    date: "2026-11-06",
    title: "Studies managed from the Studies page",
    body: "Posting, editing and removing a study all happen on the Studies page now, and each study has its own page showing its applicants. The end date and the money are fixed once a study is live, so participants are not left waiting.",
  },
  {
    date: "2026-11-04",
    title: "Applicant stages",
    body: "Researchers approve applicants through the study: applied, eligibility confirmed, experiment, validation, completed. Participants follow their own progress, and anyone turned down at eligibility is withdrawn rather than left waiting.",
  },
  {
    date: "2026-11-04",
    title: "Study timelines",
    body: "Every study now carries its eligibility, experiment, validation and end dates, shown as a timeline on the study card.",
  },
  {
    date: "2026-11-02",
    title: "Identity checks",
    body: "Participants verify their identity before applying, and researchers before posting a study or creating a group. Text posted to the site is screened for anything inappropriate.",
  },
  {
    date: "2026-11-02",
    title: "Public research groups",
    body: "Group leads can make a group public, so it shows to visitors who are not signed in. Members stay hidden until you sign in as a researcher.",
  },
];

export const UPCOMING = [
  {
    title: "Payments",
    body: "Taking the study budget up front, holding it, and paying each participant once they complete. Nothing is charged today: budgets are recorded but no money moves.",
  },
  {
    title: "Email and password sign-in",
    body: "Signing in without a Microsoft or GitHub account.",
  },
  {
    title: "Messaging between researchers and participants",
    body: "Confirming eligibility without leaving the platform.",
  },
];
