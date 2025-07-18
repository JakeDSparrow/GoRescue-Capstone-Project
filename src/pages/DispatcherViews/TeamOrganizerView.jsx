import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDocs, setDoc } from 'firebase/firestore';

const roleLabels = { teamLeader: 'Team Leader', emt1: 'EMT 1', emt2: 'EMT 2', ambulanceDriver: 'Ambulance Driver' };
const defaultTeam = { teamLeader: null, emt1: null, emt2: null, ambulanceDriver: null };

export default function TeamOrganizerView() {
  const [responders, setResponders] = useState([]);
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teams, setTeams] = useState({
      alpha: {
        teamLeader: null,
        emt1: null,
        emt2: null,
        ambulanceDriver: null
      },
      bravo: {
        teamLeader: null,
        emt1: null,
        emt2: null,
        ambulanceDriver: null
      }
    });
  const db = getFirestore();


  useEffect(() => {
    async function load() {
      try {
        const snapshot = await getDocs(collection(db, 'teams'));
        const allowedTeams = ['alpha', 'bravo'];
        const newTeams = {
          alpha: { ...defaultTeam },
          bravo: { ...defaultTeam },
        };

        snapshot.forEach(docSnap => {
          const teamId = docSnap.id.toLowerCase();
          if (allowedTeams.includes(teamId)) {
            newTeams[teamId] = { ...defaultTeam, ...docSnap.data() };
          }
        });

        setTeams(newTeams);
      } catch (err) {
        console.error('Error loading teams:', err);
      }
    }
    
    load();
  }, [db]);
  
  useEffect(() => {
      const loadResponders = async () => {
        try {
          const db = getFirestore();
          const querySnapshot = await getDocs(collection(db, 'mdrrmo-users'));
  
          const allUsers = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          }));
  
          console.log("All Users:", allUsers); // <== See all user objects
  
          const filtered = allUsers.filter(user =>
            user.role?.toLowerCase() === 'responder' 
            && (user.status?.toLowerCase() !== 'inactive' || user.status === undefined)
          );
  
          console.log("Filtered Responders:", filtered); // <== Check what remains
  
          setResponders(filtered);
        } catch (error) {
          console.error('Error loading responders:', error);
        }
      };
  
    loadResponders();
  }, []);

  async function updateTeam(teamKey, updatedData) {
    try {
      await setDoc(doc(db, 'teams', teamKey), updatedData);
      setTeams(prev => ({ ...prev, [teamKey]: updatedData }));
    } catch (err) {
      console.error('Error writing team:', err);
    }
  }

  return (
    <div className="card">
      <h2>Team Organizer</h2>

      <div className="teams-container">
        {Object.entries(teams).map(([teamKey, teamRoles]) => (
          <div key={teamKey} className="team-card">
            <div className="team-card-header">
              <h3>{`TEAM ${teamKey.toUpperCase()}`}</h3>
              <button
                className="edit-button"
                onClick={() => {
                  setSelectedTeamKey(teamKey);
                  setIsModalOpen(true);
                }}
              >
                <i className="fas fa-edit" /> Edit
              </button>
            </div>
            <div className="team-card-body">
              <ul>
                {Object.entries(roleLabels).map(([roleKey, roleName]) => (
                  <li key={roleKey}>
                    <strong>{roleName}:</strong>{' '}
                    {teams[teamKey][roleKey]?.fullName || <em>Not assigned</em>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && selectedTeamKey && (
        <TeamEditorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          teamDate={selectedTeamKey}
          currentTeam={teams[selectedTeamKey]}
          responders={responders}
          onSave={updateTeam}
        />
      )}
    </div>
  );
}
