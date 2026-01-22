/**
 * Script to regenerate terrain from command line
 * Run with: npm run regenerate-terrain
 */
import { storage } from "../storage";

async function main() {
    console.log("Regenerating terrain...");

    try {
        await storage.generateTerrain();
        console.log("Terrain regenerated successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Failed to regenerate terrain:", error);
        process.exit(1);
    }
}

main();
