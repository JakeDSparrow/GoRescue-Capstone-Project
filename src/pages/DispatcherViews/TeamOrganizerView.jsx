import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const roleLabels = {
  teamLeader: 'Team Leader',
  emt1: 'EMT 1',
  emt2: 'EMT 2',
  ambulanceDriver: 'Ambulance Driver',
};
const defaultTeamDeck = {
  teamLeader: null,
  emt1: null,
  emt2: null,
  ambulanceDriver: null,
};

export default function TeamOrganizerView() {
  const [responders, setResponders] = useState([]);
  const [teams, setTeams] = useState({ alpha: [], bravo: [] });
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const db = getFirestore();

  useEffect(() => {
    const loadTeams = async () => {
      const snapshot = await getDocs(collection(db, 'teams'));
      const result = { alpha: [], bravo: [] };

      snapshot.forEach(docSnap => {
        const [teamKey, index] = docSnap.id.split('-');
        const idx = parseInt(index, 10);
        if (!result[teamKey]) return;
        result[teamKey][idx] = { ...defaultTeamDeck, ...docSnap.data() };
      });

      setTeams(result);
    };

    const loadResponders = async () => {
      const snapshot = await getDocs(collection(db, 'mdrrmo-users'));
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      const filtered = allUsers.filter(
        u => u.role?.toLowerCase() === 'responder' && u.status !== 'inactive'
      );
      setResponders(filtered);
    };

    loadTeams();
    loadResponders();
  }, []);

  const handleEdit = (teamKey, deckIndex) => {
    setSelectedTeamKey(teamKey);
    setSelectedDeckIndex(deckIndex);
    setIsModalOpen(true);
  };

  const handleSave = async (teamKey, deckIndex, updatedDeck) => {
    const docId = `${teamKey}-${deckIndex}`;
    await setDoc(doc(db, 'teams', docId), updatedDeck);

    setTeams(prev => {
      const updated = { ...prev };
      updated[teamKey][deckIndex] = updatedDeck;
      return updated;
    });
  };

  const addDeck = (teamKey) => {
    setTeams(prev => {
      if (prev[teamKey].length >= 3) {
        alert('Each team can only have a maximum of 3 decks.');
        return prev;
      }

      const updated = { ...prev };
      updated[teamKey] = [...updated[teamKey], { ...defaultTeamDeck }];
      return updated;
    });
  };


  const handleDeleteDeck = async (teamKey, deckIndex) => {
    const updated = { ...teams };
    updated[teamKey].splice(deckIndex, 1);

    // Delete all documents under the teamKey to avoid leftovers
    const existingDocs = await getDocs(collection(db, 'teams'));
    const deleteOps = [];
    existingDocs.forEach(docSnap => {
      const [key, idx] = docSnap.id.split('-');
      if (key === teamKey) deleteOps.push(deleteDoc(doc(db, 'teams', docSnap.id)));
    });
    await Promise.all(deleteOps);

    // Re-save the updated team decks with new indexes
    const saveOps = updated[teamKey].map((deck, index) =>
      setDoc(doc(db, 'teams', `${teamKey}-${index}`), deck)
    );
    await Promise.all(saveOps);

    setTeams(updated);
  };

  return (
    <div className="team-organizer-container">
      <h2>Team Organizer</h2>

      <div className="teams-container">
        {['alpha', 'bravo'].map(teamKey => (
          <div key={teamKey} className="team-section">
            <h3>{`Team ${teamKey.toUpperCase()}`}</h3>
            <button
              className="add-deck-btn"
              onClick={() => addDeck(teamKey)}
              disabled={teams[teamKey]?.length >= 3}
            >
              + Add Deck
            </button>

            {teams[teamKey]?.map((deck, idx) => (
              <div className={`deck-card ${deck.currentTeam ? 'active' : ''}`} key={idx}>
                <div className="deck-header">
                <strong>Deck {idx + 1}</strong>
                  <div className="deck-controls">
                    <button className="edit-button" onClick={() => handleEdit(teamKey, idx)}>
                      ✏️ Edit
                    </button>
                    {teams[teamKey]?.length > 1 && (
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteDeck(teamKey, idx)}
                        title="Delete Deck"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="deck-body">
                  {Object.entries(roleLabels).map(([roleKey, label]) => {
                    const iconMap = {
                      teamLeader: 'fas fa-user-shield',
                      emt1: 'fas fa-user-nurse',
                      emt2: 'fas fa-user-nurse',
                      ambulanceDriver: 'fas fa-ambulance',
                    };
                    const user = deck[roleKey];
                    return (
                      <div key={roleKey} className="deck-role">
                        <i className={iconMap[roleKey]}></i>
                        <span className="role-label">{label}</span>
                        <span className="role-name">
                          {user?.fullName || <span className="unassigned">Not assigned</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <TeamEditorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          teamDate={selectedTeamKey}
          currentTeam={teams[selectedTeamKey][selectedDeckIndex]}
          responders={responders}
          onSave={(teamKey, data) => {
            handleSave(teamKey, selectedDeckIndex, data);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
