import { prisma } from '../db.js';
import { PlexService } from './plex.service.js';
import { JellyfinService } from './jellyfin.service.js';

export class SyncService {
  static async syncServer(serverId: string): Promise<{ added: number; updated: number; total: number }> {
    const server = await prisma.mediaServer.findUnique({
      where: { id: serverId },
      include: { libraries: true },
    });

    if (!server) {
      throw new Error(`Media server with ID ${serverId} not found`);
    }

    let added = 0;
    let updated = 0;
    let total = 0;

    if (server.type === 'plex') {
      let libraries = server.libraries.filter(lib => lib.enabled);
      if (libraries.length === 0) {
        // Auto-discover libraries if none are configured yet
        const discovered = await PlexService.getMovieSections(server.url, server.token);
        for (const disc of discovered) {
          const createdLib = await prisma.mediaLibrary.create({
            data: {
              serverId: server.id,
              serverSectionId: disc.id,
              name: disc.title,
              type: 'movie',
              enabled: true,
            },
          });
          libraries.push(createdLib);
        }
      }

      for (const lib of libraries) {
        let offset = 0;
        const batchSize = 100;
        let hasMore = true;

        while (hasMore) {
          const { movies, totalSize } = await PlexService.getMoviesFromSection(
            server.url,
            server.token,
            lib.serverSectionId,
            batchSize,
            offset
          );

          total = totalSize;

          for (const movie of movies) {
            const existing = await prisma.mediaItem.findUnique({
              where: {
                serverId_serverItemId: {
                  serverId: server.id,
                  serverItemId: movie.serverItemId,
                },
              },
            });

            const data = {
              title: movie.title,
              originalTitle: movie.originalTitle,
              year: movie.year,
              overview: movie.overview,
              tagline: movie.tagline,
              duration: movie.duration,
              rating: movie.rating,
              contentRating: movie.contentRating,
              genres: JSON.stringify(movie.genres),
              directors: JSON.stringify(movie.directors),
              studios: JSON.stringify(movie.studios),
              collections: JSON.stringify(movie.collections),
              posterUrl: movie.posterPath,
              backdropUrl: movie.backdropPath,
              rawMetadata: movie.partKey ? JSON.stringify({ partKey: movie.partKey }) : null,
            };

            if (existing) {
              await prisma.mediaItem.update({
                where: { id: existing.id },
                data,
              });
              updated++;
            } else {
              await prisma.mediaItem.create({
                data: {
                  ...data,
                  serverId: server.id,
                  serverItemId: movie.serverItemId,
                },
              });
              added++;
            }
          }

          offset += movies.length;
          if (movies.length === 0 || offset >= totalSize) {
            hasMore = false;
          }
        }
      }
    } else if (server.type === 'jellyfin') {
      let libraries = server.libraries.filter(lib => lib.enabled);
      if (libraries.length === 0) {
        const discovered = await JellyfinService.getMovieSections(server.url, server.token, server.userId);
        for (const disc of discovered) {
          const createdLib = await prisma.mediaLibrary.create({
            data: {
              serverId: server.id,
              serverSectionId: disc.id,
              name: disc.title,
              type: 'movie',
              enabled: true,
            },
          });
          libraries.push(createdLib);
        }
      }

      for (const lib of libraries) {
        let startIndex = 0;
        const batchSize = 100;
        let hasMore = true;

        while (hasMore) {
          const { movies, totalSize } = await JellyfinService.getMoviesFromSection(
            server.url,
            server.token,
            lib.serverSectionId,
            server.userId,
            batchSize,
            startIndex
          );

          total = totalSize;

          for (const movie of movies) {
            const existing = await prisma.mediaItem.findUnique({
              where: {
                serverId_serverItemId: {
                  serverId: server.id,
                  serverItemId: movie.serverItemId,
                },
              },
            });

            const data = {
              title: movie.title,
              originalTitle: movie.originalTitle,
              year: movie.year,
              overview: movie.overview,
              tagline: movie.tagline,
              duration: movie.duration,
              rating: movie.rating,
              contentRating: movie.contentRating,
              genres: JSON.stringify(movie.genres),
              directors: JSON.stringify(movie.directors),
              studios: JSON.stringify(movie.studios),
              collections: JSON.stringify(movie.collections),
              posterUrl: movie.posterTag ? `/Items/${movie.serverItemId}/Images/Primary` : null,
              backdropUrl: movie.backdropTag ? `/Items/${movie.serverItemId}/Images/Backdrop` : null,
            };

            if (existing) {
              await prisma.mediaItem.update({
                where: { id: existing.id },
                data,
              });
              updated++;
            } else {
              await prisma.mediaItem.create({
                data: {
                  ...data,
                  serverId: server.id,
                  serverItemId: movie.serverItemId,
                },
              });
              added++;
            }
          }

          startIndex += movies.length;
          if (movies.length === 0 || startIndex >= totalSize) {
            hasMore = false;
          }
        }
      }
    }

    await prisma.mediaServer.update({
      where: { id: server.id },
      data: { lastSyncAt: new Date() },
    });

    return { added, updated, total };
  }

  static async seedSampleLibraryIfNeeded(): Promise<boolean> {
    const count = await prisma.mediaItem.count();
    if (count > 0) return false;

    // Create a Demo / Sample Virtual Server with classic public-domain / creative commons movies
    let demoServer = await prisma.mediaServer.findFirst({
      where: { name: 'Demo Movies Library' },
    });

    if (!demoServer) {
      demoServer = await prisma.mediaServer.create({
        data: {
          name: 'Demo Movies Library',
          type: 'demo',
          url: 'https://commondatastorage.googleapis.com',
          token: 'demo-token',
          isActive: true,
        },
      });
    }

    const sampleMovies = [
      {
        serverItemId: 'demo-bb',
        title: 'Big Buck Bunny',
        year: 2008,
        overview: 'A large and lovable rabbit deals with bullying forest creatures in this iconic open-source animation.',
        tagline: 'Big bunny, big adventures.',
        duration: 596, // ~10 mins
        rating: 7.6,
        contentRating: 'G',
        genres: ['Animation', 'Comedy', 'Family'],
        directors: ['Sacha Goedegebure'],
        studios: ['Blender Foundation'],
        collections: ['Open Cinema'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/600px-Big_buck_bunny_poster_big.jpg',
        backdropUrl: 'https://peach.blender.org/wp-content/uploads/bbb-splash.png',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        }),
      },
      {
        serverItemId: 'demo-ed',
        title: "Elephants Dream",
        year: 2006,
        overview: 'Proog and Emo journey through the mechanical, surreal labyrinth of an infinite machine.',
        tagline: 'The world first open movie.',
        duration: 654, // ~11 mins
        rating: 7.0,
        contentRating: 'PG',
        genres: ['Animation', 'Sci-Fi', 'Fantasy'],
        directors: ['Bassam Kurdali'],
        studios: ['Blender Foundation'],
        collections: ['Open Cinema'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Elephants_Dream_poster.jpg/600px-Elephants_Dream_poster.jpg',
        backdropUrl: 'https://orange.blender.org/wp-content/themes/orange/images/media/gallery/hi_res/06_1920x1080.jpg',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        }),
      },
      {
        serverItemId: 'demo-sintel',
        title: 'Sintel',
        year: 2010,
        overview: 'A lonely young woman named Sintel searches across harsh snowy peaks and arid wastelands for a baby dragon companion.',
        tagline: 'The search begins.',
        duration: 888, // ~15 mins
        rating: 7.8,
        contentRating: 'PG-13',
        genres: ['Animation', 'Action', 'Fantasy', 'Adventure'],
        directors: ['Colin Levy'],
        studios: ['Blender Foundation'],
        collections: ['Open Cinema'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/600px-Sintel_poster.jpg',
        backdropUrl: 'https://durian.blender.org/wp-content/uploads/2010/09/wallpaper_01.jpg',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        }),
      },
      {
        serverItemId: 'demo-tos',
        title: 'Tears of Steel',
        year: 2012,
        overview: 'In a dystopian future Amsterdam, a squad of warriors attempts to stage an emotional intervention to stop rampaging robots.',
        tagline: 'Explore the future.',
        duration: 734, // ~12 mins
        rating: 7.2,
        contentRating: 'PG-13',
        genres: ['Action', 'Sci-Fi'],
        directors: ['Ian Hubert'],
        studios: ['Blender Foundation'],
        collections: ['Open Cinema'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Tears_of_Steel_poster.jpg/600px-Tears_of_Steel_poster.jpg',
        backdropUrl: 'https://mango.blender.org/wp-content/gallery/4k-renders/03_03_comp_00063.jpg',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        }),
      },
      {
        serverItemId: 'demo-night-living-dead',
        title: 'Night of the Living Dead',
        year: 1968,
        overview: 'A ragtag group of Pennsylvanians barricade themselves in an old farmhouse to remain safe from a bloodthirsty horde of flesh-eating ghouls.',
        tagline: 'They keep coming back in a bloodthirsty lust for HUMAN FLESH!',
        duration: 5760, // 96 mins
        rating: 7.9,
        contentRating: 'R',
        genres: ['Horror', 'Classic', 'Thriller'],
        directors: ['George A. Romero'],
        studios: ['Image Ten'],
        collections: ['Romero Dead Series'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Night_of_the_Living_Dead_%281968%29_theatrical_poster.jpg/600px-Night_of_the_Living_Dead_%281968%29_theatrical_poster.jpg',
        backdropUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Night_of_the_Living_Dead_still.png/800px-Night_of_the_Living_Dead_still.png',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        }),
      },
      {
        serverItemId: 'demo-charade',
        title: 'Charade',
        year: 1963,
        overview: 'Romance and suspense in Paris, as a woman is pursued by several men who want a fortune her murdered husband had stolen.',
        tagline: 'You can expect the unexpected when Audrey Hepburn and Cary Grant meet in Charade!',
        duration: 6780, // 113 mins
        rating: 7.9,
        contentRating: 'Approved',
        genres: ['Comedy', 'Mystery', 'Romance', 'Thriller', 'Classic'],
        directors: ['Stanley Donen'],
        studios: ['Universal Pictures'],
        collections: ['Classic Cinema'],
        posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Charade_poster.jpg/600px-Charade_poster.jpg',
        backdropUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Charade_trailer_Cary_Grant_%26_Audrey_Hepburn.jpg/800px-Charade_trailer_Cary_Grant_%26_Audrey_Hepburn.jpg',
        rawMetadata: JSON.stringify({
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        }),
      }
    ];

    for (const movie of sampleMovies) {
      await prisma.mediaItem.create({
        data: {
          serverId: demoServer.id,
          serverItemId: movie.serverItemId,
          title: movie.title,
          year: movie.year,
          overview: movie.overview,
          tagline: movie.tagline,
          duration: movie.duration,
          rating: movie.rating,
          contentRating: movie.contentRating,
          genres: JSON.stringify(movie.genres),
          directors: JSON.stringify(movie.directors),
          studios: JSON.stringify(movie.studios),
          collections: JSON.stringify(movie.collections),
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          rawMetadata: movie.rawMetadata,
        },
      });
    }

    return true;
  }
}
