function createRaceCards(data) {
  const races = Array.isArray(data.races) ? data.races : [];
  return races.slice(0, 6).map((race) => ({
    id: race.id || race.raceId || '',
    title: race.title || 'Untitled Race',
    status: race.status || 'unknown',
    summary: race.summary || race.challenge || ''
  }));
}

function createDashboardSummary(data) {
  const dashboard = data.dashboard || {};
  return {
    totalUsers: dashboard.totalUsers || 0,
    activeRaces: dashboard.activeRaces || 0,
    systemHealth: dashboard.systemHealth || 'unknown'
  };
}

module.exports = {
  createRaceCards,
  createDashboardSummary
};