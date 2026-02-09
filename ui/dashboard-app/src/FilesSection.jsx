const React = require('react');

function formatAge(ageMinutes) {
  if (ageMinutes == null || ageMinutes === 0) return '';
  if (ageMinutes < 60) return ageMinutes + 'm ago';
  return Math.round(ageMinutes / 60) + 'h ago';
}

function getUnopenedAndUnreviewed(scoreData) {
  const unopened = (scoreData && scoreData.unopenedFiles) ? scoreData.unopenedFiles : { count: 0, files: [] };
  const unreviewedSuggestions = (scoreData && scoreData.unreviewedSuggestions) ? scoreData.unreviewedSuggestions : { count: 0, files: [] };
  const debt = scoreData && scoreData.debt;
  const debtFiles = (debt && (debt.allFiles || debt.files)) || [];
  const debtTotal = (debt && debt.unreviewedFiles != null) ? debt.unreviewedFiles : debtFiles.length;
  const pendingFiles = (scoreData && scoreData.suggestions && scoreData.suggestions.pendingFiles) ? scoreData.suggestions.pendingFiles : [];
  const pendingCount = (scoreData && scoreData.suggestions && scoreData.suggestions.pending != null) ? scoreData.suggestions.pending : pendingFiles.length;
  const useFallback = (unopened.count === 0 && unreviewedSuggestions.count === 0) && (debtTotal > 0 || pendingCount > 0);
  if (useFallback && scoreData) {
    const list = (debt.files || debt.allFiles || []).slice(0, 15).map(f => ({ path: f.path || f.fullPath, fullPath: f.fullPath || f.path, ageMinutes: f.ageMinutes || 0 }));
    return {
      unopened: { count: debtTotal, files: list },
      unreviewedSuggestions: { count: pendingCount, files: pendingFiles }
    };
  }
  return {
    unopened: { count: unopened.count != null ? unopened.count : debtTotal, files: unopened.files || [] },
    unreviewedSuggestions: { count: unreviewedSuggestions.count != null ? unreviewedSuggestions.count : pendingCount, files: unreviewedSuggestions.files || [] }
  };
}

function FilesSection(props) {
  const scoreData = (props.payload && props.payload.scoreData) || {};
  const { unopened, unreviewedSuggestions } = getUnopenedAndUnreviewed(scoreData);
  const maxItems = 15;

  const unopenedList = (unopened.files || []).slice(0, maxItems);
  const unreviewedList = (unreviewedSuggestions.files || []).slice(0, maxItems);

  return React.createElement('div', { className: 'files-section' },
    React.createElement('h3', null, 'Unopened files: ', unopened.count || 0),
    React.createElement('ul', { className: 'files-list' },
      unopenedList.length === 0
        ? React.createElement('li', null, React.createElement('em', null, 'No unopened files.'))
        : unopenedList.map(function (f, i) {
            const age = formatAge(f.ageMinutes);
            return React.createElement('li', { key: i },
              React.createElement('code', null, f.path || f.fullPath || ''),
              age ? React.createElement('span', { className: 'file-age' }, ' (', age, ')') : null
            );
          })
    ),
    React.createElement('h3', null, 'Unreviewed suggestions: ', unreviewedSuggestions.count || 0),
    React.createElement('ul', { className: 'files-list' },
      unreviewedList.length === 0
        ? React.createElement('li', null, React.createElement('em', null, 'No unreviewed suggestions.'))
        : unreviewedList.map(function (f, i) {
            const age = formatAge(f.ageMinutes);
            return React.createElement('li', { key: i },
              React.createElement('code', null, f.path || f.fullPath || ''),
              age ? React.createElement('span', { className: 'file-age' }, ' (', age, ')') : null
            );
          })
    )
  );
}

module.exports = { default: FilesSection };
