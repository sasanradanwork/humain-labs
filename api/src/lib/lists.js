"use strict";
// Standard lists for researcher profiles, groups and studies. Filters on the
// researchers and groups pages use these exact values, so keep this file identical
// to web/src/lib/lists.js (api/test checks that they match).
const FIELDS = [
  "Anthropology", "Behavioural economics", "Biology", "Chemistry", "Cognitive science", "Computer science",
  "Developmental psychology", "Economics", "Education", "Engineering", "Environmental science", "History",
  "Human–computer interaction", "Linguistics", "Mathematics", "Medicine", "Neuroscience", "Nursing", "Philosophy",
  "Physics", "Political science", "Psychology", "Public health", "Sociology", "Other",
];
const POSITIONS = [
  "PhD student", "Research assistant", "Postdoctoral researcher", "Research fellow", "Lecturer", "Senior lecturer",
  "Assistant professor", "Associate professor", "Professor", "Principal investigator", "Clinician researcher",
  "Industry researcher", "Independent researcher", "Other",
];
const COUNTRY_NAMES = [
  "Argentina", "Australia", "Bangladesh", "Belgium", "Brazil", "Canada", "Chile", "China", "Colombia", "Denmark",
  "Egypt", "Ethiopia", "Finland", "France", "Germany", "Ghana", "Greece", "India", "Indonesia", "Ireland", "Italy",
  "Japan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan",
  "Peru", "Philippines", "Poland", "Portugal", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sweden", "Switzerland", "Tanzania", "Thailand", "Turkey", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Vietnam",
];
// The four disciplines a researcher files themselves under. The leaderboard and the
// researchers page filter on these exact values.
const DISCIPLINES = ["Science", "Technology", "Engineering", "Mathematics"];
// ISO 3166-1 alpha-2 for each country above, so a flag can be drawn beside the name.
const COUNTRY_CODES = {
  "Argentina": "AR", "Australia": "AU", "Bangladesh": "BD", "Belgium": "BE", "Brazil": "BR", "Canada": "CA",
  "Chile": "CL", "China": "CN", "Colombia": "CO", "Denmark": "DK", "Egypt": "EG", "Ethiopia": "ET",
  "Finland": "FI", "France": "FR", "Germany": "DE", "Ghana": "GH", "Greece": "GR", "India": "IN",
  "Indonesia": "ID", "Ireland": "IE", "Italy": "IT", "Japan": "JP", "Kenya": "KE", "Malaysia": "MY",
  "Mexico": "MX", "Morocco": "MA", "Netherlands": "NL", "New Zealand": "NZ", "Nigeria": "NG", "Norway": "NO",
  "Pakistan": "PK", "Peru": "PE", "Philippines": "PH", "Poland": "PL", "Portugal": "PT", "Saudi Arabia": "SA",
  "Singapore": "SG", "South Africa": "ZA", "South Korea": "KR", "Spain": "ES", "Sweden": "SE",
  "Switzerland": "CH", "Tanzania": "TZ", "Thailand": "TH", "Turkey": "TR", "Uganda": "UG", "Ukraine": "UA",
  "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US", "Vietnam": "VN",
};
module.exports = { FIELDS, POSITIONS, COUNTRY_NAMES, DISCIPLINES, COUNTRY_CODES };
