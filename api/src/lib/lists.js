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
module.exports = { FIELDS, POSITIONS, COUNTRY_NAMES };
