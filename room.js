import { db, auth } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, getDoc, setDoc, getDocs, where } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';


const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
if (!roomId) {
  alert('No room ID provided.');
  window.location.href = './room-list.html';
}

const leaveRoomButton = document.getElementById('leave-room');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessage = document.getElementById('send-message');
const videoCallBtn = document.getElementById('video-call-btn');
const videoCallSection = document.getElementById('video-call-section');
const chatSection = document.getElementById('chat-section');
const backToChatBtn = document.getElementById('back-to-chat-btn');
const participantsList = document.getElementById('participants-list');
const chatTab = document.getElementById('chat-tab');
const videoTab = document.getElementById('video-tab');

// Initially show only chat
chatSection.style.display = 'block';
videoCallSection.style.display = 'none';

// Function to handle opening Meet link
async function openMeetLink(roomId) {
  try {
    if (!roomId) {
      alert('Invalid room ID.');
      return;
    }

    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await getDoc(roomRef);

    if (!roomDoc.exists()) {
      alert('Room not found.');
      return;
    }

    const roomData = roomDoc.data();

    // Check if the room already has a meet link assigned
    if (roomData.meetLink) {
      // If a link is assigned, open it directly
      window.open(roomData.meetLink, '_blank');
      //alert('Opening assigned Meet link.');
      return;
    }

    // If no meet link is assigned, query all meetLinks in the collection
    const meetLinksRef = collection(db, 'meetLinks');
    const meetLinksQuery = query(meetLinksRef, where('assigned', '==', false));
    const meetLinksSnapshot = await getDocs(meetLinksQuery);

    if (meetLinksSnapshot.empty) {
      alert('No available Meet links.');
      return;
    }

    let meetLinkDoc;
    let meetLink;

    // Loop through the documents to find an unassigned meet link
    meetLinksSnapshot.forEach((doc) => {
      const linkData = doc.data();
      if (linkData.assigned === false) {
        meetLinkDoc = doc;
        meetLink = linkData.url;
        return;
      }
    });

    if (!meetLinkDoc) {
      alert('No available Meet links.');
      return;
    }

    // Update the meetLink document to mark it as assigned
    await setDoc(meetLinkDoc.ref, { assigned: true }, { merge: true });

    // Assign the meet link to the room document
    await setDoc(roomRef, { meetLink: meetLink }, { merge: true });

    // Open the Meet link
    window.open(meetLink, '_blank');

    //alert('Meet link assigned and opened.');

  } catch (error) {
    console.error('Error assigning Meet link:', error);
    alert('Something went wrong. Please try again.');
  }
}



// Function to leave the room with confirmation
async function leaveRoom() {
  if (!auth.currentUser) {
    alert('Please log in to leave the room.');
    return;
  }

  const confirmLeave = confirm('Are you sure you want to leave the room?');
  if (!confirmLeave) return;

  const userId = auth.currentUser.uid;
  try {
    const memberRef = doc(db, 'rooms', roomId, 'room_members', userId);
    await deleteDoc(memberRef);
    alert('You have left the room.');
    window.location.href = './room-list.html';
  } catch (error) {
    console.error('Error leaving room:', error);
    alert('Failed to leave room.');
  }
}

leaveRoomButton?.addEventListener('click', leaveRoom);

// Handle tab switching
chatTab?.addEventListener('click', () => {
  chatSection.style.display = 'block';
  videoCallSection.style.display = 'none';
  chatTab.classList.add('active');
  videoTab.classList.remove('active');
});

videoTab?.addEventListener('click', () => {
  chatSection.style.display = 'none';
  videoCallSection.style.display = 'block';
  videoTab.classList.add('active');
  chatTab.classList.remove('active');
});

// Handle authentication
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert('Please log in to access the room.');
    window.location.href = './room-list.html';
    return;
  }

  const roomMembersRef = collection(db, 'rooms', roomId, 'room_members');
  const memberDoc = await getDoc(doc(roomMembersRef, user.uid));
  if (!memberDoc.exists()) {
    try {
      await setDoc(doc(roomMembersRef, user.uid), {
        userId: user.uid,
        userName: user.displayName || `User_${user.uid.substring(0, 5)}`,
        joinedAt: serverTimestamp(),
      });
      console.log('User added to the room successfully');
    } catch (error) {
      console.error('Error adding user to the room:', error);
    }
  }

  // Load participants list
  onSnapshot(roomMembersRef, (snapshot) => {
    participantsList.innerHTML = '';
    if (snapshot.empty) {
      participantsList.innerHTML = '<li>No participants yet.</li>';
      return;
    }
    snapshot.forEach((doc) => {
      const member = doc.data();
      const participantItem = document.createElement('li');
      participantItem.className = 'participant-item';
      participantItem.innerHTML = `
        <img src="https://www.gravatar.com/avatar/${member.userId}?d=mp" alt="${member.userName || member.userId}" style="width: 30px; height: 30px; border-radius: 50%;">
        ${member.userName || `User_${member.userId.substring(0, 5)}`}
      `;
      participantsList.appendChild(participantItem);
    });
  });

  function loadMessages() {
    if (chatMessages) {
      const messagesQuery = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
      onSnapshot(messagesQuery, (snapshot) => {
        chatMessages.innerHTML = '';
        if (snapshot.empty) {
          chatMessages.innerHTML = '<p class="text-gray-500">No messages yet.</p>';
          return;
        }

        snapshot.forEach((doc) => {
          const msg = doc.data();
          const isCurrentUser = msg.userId === user.uid;
          const messageDate = msg.createdAt?.toDate();
          const msgContainer = document.createElement('div');
          msgContainer.className = 'flex flex-col mb-2 ' + (isCurrentUser ? 'items-end' : 'items-start');
          msgContainer.innerHTML = `
            <div class="max-w-xs p-2 rounded-lg" style="background-color: ${isCurrentUser ? '#D4BEE4' : '#EEEEEE'}">
              <div class="text-xs font-bold mb-1 ${isCurrentUser ? 'text-right' : 'text-left'}">${msg.userName}:</div>
              <div class="text-sm flex items-center gap-2">
                <span>${msg.text}</span>
                <span class="text-[10px] text-gray-500">${messageDate ? messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            </div>
          `;
          chatMessages.appendChild(msgContainer);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }
  }
  loadMessages();

  // Sending message
  sendMessage?.addEventListener('click', async () => {
    await sendChatMessage();
  });

  chatInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendChatMessage();
    }
  });

  async function sendChatMessage() {
    const text = chatInput?.value.trim();
    if (!text) return;
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        text,
        userName: auth.currentUser.displayName || `User_${auth.currentUser.uid.substring(0, 5)}`,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      chatInput.value = '';
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  }

  // Handle Video Call Button
  videoCallBtn?.addEventListener('click', () => {
    chatSection.style.display = 'none';
    videoCallSection.style.display = 'block';
  });

  // Handle Back to Chat Button
  backToChatBtn?.addEventListener('click', () => {
    videoCallSection.style.display = 'none';
    chatSection.style.display = 'block';
  });

  // Handle Meet Link Button
  const meetLinkBtn = document.getElementById('meet-link-btn');
  if (meetLinkBtn) {
    meetLinkBtn.addEventListener('click', () => {
      openMeetLink(roomId);
    });
  } else {
    console.error('Meet Link Button not found.');
  }
});
