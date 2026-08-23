
export const redisKeys = {
  playerState: (roomId: string) => `queue:${roomId}:player`,
  roomOnline: (roomId: string) => `room:${roomId}:online`,
  publicRooms: () => `cache:public_rooms`,
  roomDetails: (roomId: string) => `cache:room:${roomId}`,
  userProfile: (userId: string) => `cache:user:${userId}`,
  songVoteCounts: (songId: string) => `song:${songId}:votes`,
  songUserVotes: (songId: string) => `song:${songId}:user_votes`,
  tokenBlacklist: (jti: string) => `blacklist:${jti}`,
} as const;
