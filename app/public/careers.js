export const careers = [
  { id: 'marketing', title: 'Marketing and communications', keyword: 'marketing coordinator', description: 'Explore work involving content, campaigns, and communicating ideas.' },
  { id: 'sales', title: 'Sales and customer relationships', keyword: 'sales representative', description: 'Explore work involving customer conversations, product explanations, and relationships.' },
  { id: 'operations', title: 'Business operations and coordination', keyword: 'operations coordinator', description: 'Explore work involving schedules, processes, and coordinating tasks.' }
];
const reasons = {
  interest: { marketing: 'You enjoy creating content and promoting ideas.', sales: 'You enjoy talking with customers and building relationships.', operations: 'You enjoy organizing projects and improving processes.' },
  strength: { marketing: 'You want to use writing and creative communication.', sales: 'You want to use listening and explaining skills.', operations: 'You want to use planning and attention to detail.' },
  task: { marketing: 'You would like to learn campaign planning and review.', sales: 'You would like to learn how to help customers choose solutions.', operations: 'You would like to learn team scheduling and coordination.' }
};
export function validAnswers(answers) {
  return ['interest', 'strength', 'task'].every(field => careers.some(career => career.id === answers?.[field]));
}
export function recommend(answers) {
  if (!validAnswers(answers)) throw new Error('Please answer all three questions.');
  return careers.map(career => {
    const evidence = Object.keys(reasons).filter(field => answers[field] === career.id).map(field => reasons[field][career.id]);
    return { ...career, score: evidence.length, explanation: evidence.length ? evidence.join(' ') : 'None of your answers directly pointed here. This is an additional direction to explore if the work appeals to you.' };
  }).sort((a, b) => b.score - a.score);
}
