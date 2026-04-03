export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  coverURL?: string;
  role: 'admin' | 'user';
  location?: string;
  status?: string;
  gallery?: string[];
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: 'admin' | 'user';
  content: string;
  createdAt: any; // Timestamp
  imageURL?: string;
  likes?: string[]; // Array of user UIDs
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: any;
  read?: boolean;
  deletedByAdmin?: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastTimestamp: any;
  unreadCount?: { [uid: string]: number };
}
