import React, { useEffect, useState } from 'react'; 
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  doc,
  updateDoc
} from 'firebase/firestore';

import { emergencyTypeMap, statusMap } from '../../constants/dispatchConstants';

const db = getFirestore();

export default function NotificationsView({
  notifications,
  dispatchTeam,
  dispatchAllResponders,
  viewOnMap,
  createTeam
}) {
  const [dispatchedMap, setDispatchedMap] = useState({});
  const [teamDecks, setTeamDecks] = useState({});
  const [teamReadinessMap, setTeamReadinessMap] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), snapshot => {
      const decks = {};
      snapshot.forEach(doc => {
        const [teamKey] = doc.id.split('-');
        const teamData = doc.data();
        if (!decks[teamKey]) decks[teamKey] = [];
        decks[teamKey].push({ id: doc.id, ...teamData });
      });
      setTeamDecks(decks);
    }, error => {
      console.error('[❌] Error fetching teams:', error);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!teamDecks || notifications.length === 0) return;

    const newMap = {};

    notifications.forEach((notif) => {
      const notifId = notif.id;

      const alphaTeamReady = teamDecks.alpha?.some(
        (team) =>
          team.teamLeader &&
          team.ambulanceDriver &&
          team.emt1 &&
          team.emt2
      );

      const bravoTeamReady = teamDecks.bravo?.some(
        (team) =>
          team.teamLeader &&
          team.ambulanceDriver &&
          team.emt1 &&
          team.emt2
      );

      const alreadyDispatched = dispatchedMap[notifId] || {
        alphaDispatched: false,
        bravoDispatched: false,
        bothDispatched: false,
      };

      newMap[notifId] = {
        alphaReady: alphaTeamReady,
        bravoReady: bravoTeamReady,
        alphaDispatched: alreadyDispatched.alphaDispatched,
        bravoDispatched: alreadyDispatched.bravoDispatched,
        bothDispatched: alreadyDispatched.bothDispatched,
      };
    });

    setTeamReadinessMap(newMap);
  }, [teamDecks, notifications, dispatchedMap]);

  const teamExists = (teamKey) => {
    const decks = teamDecks[teamKey];
    if (!decks || decks.length === 0) return false;

    const activeDeck = decks.find(deck => deck.currentTeam);
    if (!activeDeck) return false;

    const requiredRoles = ['teamLeader', 'ambulanceDriver', 'emt1', 'emt2'];
    return requiredRoles.every(role => activeDeck[role] && activeDeck[role].uid);
  };

  const isTeamDispatched = (notifId, team) => {
    const dispatchInfo = dispatchedMap[notifId];
    if (!dispatchInfo) return false;

    if (team === 'alpha') return dispatchInfo.alphaDispatched;
    if (team === 'bravo') return dispatchInfo.bravoDispatched;
    if (team === 'all') return dispatchInfo.bothDispatched;

    return false;
  };

  const handleDispatch = (notifId, team) => {
    setDispatchedMap((prevMap) => {
      const current = prevMap[notifId] || {};
      return {
        ...prevMap,
        [notifId]: {
          ...current,
          [`${team}Dispatched`]: true,
          bothDispatched:
            team === 'all' || (current.alphaDispatched && team === 'bravo') || (current.bravoDispatched && team === 'alpha'),
        },
      };
    });
  };

  const allTeamsDispatched = Object.values(dispatchedMap).every(dispatchInfo => dispatchInfo.bothDispatched);

  return (
  <div className="notifications-container">
    <h2 className="view-title">Emergency Notifications</h2>

    {notifications.length === 0 ? (
      <div className="empty-state">
        <p>No active emergency reports at the moment.</p>
      </div>
    ) : (
      <div className="notification-list">
        {notifications.map(notification => {
          const { id } = notification;
          const typeMeta = emergencyTypeMap[notification.type] || {};
          const statusMeta = statusMap[notification.status] || {};

          const alphaDispatched = isTeamDispatched(id, 'alpha');
          const bravoDispatched = isTeamDispatched(id, 'bravo');
          const bothDispatched = isTeamDispatched(id, 'all') || (alphaDispatched && bravoDispatched);

          const alphaReady = teamReadinessMap[id]?.alphaReady;
          const bravoReady = teamReadinessMap[id]?.bravoReady;

          const respondersOnTheWay = alphaDispatched || bravoDispatched;

          // Check if ANY notification already dispatched both teams
          const allTeamsDispatchedInAnyNotif = Object.values(dispatchedMap).some(
            info => info.bothDispatched || (info.alphaDispatched && info.bravoDispatched)
          );

          // Show Charlie only if current notif isn't dispatched and somewhere else is dispatched
          const shouldOnlyShowCharlie = allTeamsDispatchedInAnyNotif && !bothDispatched;

          return (
            <div
              key={id}
              className="notification-card"
              style={{ borderLeft: `6px solid ${typeMeta.color || '#ccc'}` }}
            >
              <h3 className="notification-header">
                <i className={`fas ${typeMeta.icon}`} style={{ color: typeMeta.color, marginRight: '8px' }} />
                {typeMeta.label || notification.type} – {notification.location}

                {notification.status && (
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: statusMeta.color,
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      marginLeft: '10px'
                    }}
                  >
                    {statusMeta.label}
                  </span>
                )}
              </h3>

              <p><strong>Reporter:</strong> {notification.reporter} ({notification.reporterContact})</p>
              <p><strong>Details:</strong> {notification.details}</p>

              <div className="notification-actions">
                <button className="btn map" onClick={() => viewOnMap(notification.coordinates)}>
                  <i className="fas fa-map-marker-alt" /> View on Map
                </button>

                {respondersOnTheWay && (
                  <p className="responders-msg">🚨 Responders on the way...</p>
                )}

                {shouldOnlyShowCharlie ? (
                  <button className="btn create" onClick={async () => await createTeam('charlie')}>
                    <i className="fas fa-plus" /> Create Team Charlie
                  </button>
                ) : (
                  !bothDispatched && (
                    <>
                      {alphaReady && !alphaDispatched && (
                        <button className="btn alpha" onClick={async () => await handleDispatch(id, 'alpha')}>
                          <i className="fas fa-users" /> Team Alpha
                        </button>
                      )}
                      {bravoReady && !bravoDispatched && (
                        <button className="btn bravo" onClick={async () => await handleDispatch(id, 'bravo')}>
                          <i className="fas fa-users" /> Team Bravo
                        </button>
                      )}
                      {(alphaReady || bravoReady) && (!alphaDispatched && !bravoDispatched) && (
                        <button className="btn all" onClick={async () => await handleDispatch(id, 'all')}>
                          <i className="fas fa-broadcast-tower" /> Dispatch All
                        </button>
                      )}
                    </>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
}
