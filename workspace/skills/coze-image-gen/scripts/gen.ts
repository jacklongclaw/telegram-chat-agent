#!/usr/bin/env npx ts-node
import { ImageGenerationClient, Config } from "coze-coding-dev-sdk";

interface GenerateOptions {
  prompt?: string;
  count: number;
  size: string;
  sequential: boolean;
  maxSequential: number;
}

function pickPrompts(count: number): string[] {
  const subjects = [
    "a lobster astronaut floating in space",
    "a cozy Japanese coffee shop",
    "a cyberpunk street market at night",
    "a minimalist Scandinavian living room",
    "a magical forest with glowing mushrooms",
    "a steampunk airship above the clouds",
    "a serene zen garden with cherry blossoms",
  ];
  const styles = [
    "ultra-detailed photorealistic",
    "cinematic 35mm film style",
    "isometric 3D illustration",
    "soft watercolor painting",
    "dramatic concept art",
    "anime style illustration",
    "vintage travel poster",
  ];
  const lighting = [
    "golden hour sunlight",
    "soft diffused lighting",
    "neon glow",
    "dramatic rim lighting",
    "moody overcast",
    "warm candlelight",
  ];

  const prompts: string[] = [];
  for (let i = 0; i < count; i++) {
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const style = styles[Math.floor(Math.random() * styles.length)];
    const light = lighting[Math.floor(Math.random() * lighting.length)];
    prompts.push(`${style} of ${subject}, ${light}`);
  }
  return prompts;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const options: GenerateOptions = {
    prompt: undefined,
    count: 1,
    size: "2K",
    sequential: false,
    maxSequential: 5,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--prompt" && args[i + 1]) {
      options.prompt = args[++i];
    } else if (arg === "--count" && args[i + 1]) {
      options.count = parseInt(args[++i], 10);
    } else if (arg === "--size" && args[i + 1]) {
      options.size = args[++i];
    } else if (arg === "--sequential") {
      options.sequential = true;
    } else if (arg === "--max-sequential" && args[i + 1]) {
      options.maxSequential = parseInt(args[++i], 10);
    } else if (arg === "--help") {
      console.log(`
Usage: npx ts-node gen.ts [OPTIONS]

Options:
  --prompt <text>       Single prompt. If omitted, random prompts are generated.
  --count <n>           Number of images to generate (default: 1)
  --size <size>         Image size: 2K, 4K, or WIDTHxHEIGHT (default: 2K)
  --sequential          Enable sequential image generation (story mode)
  --max-sequential <n>  Max images for sequential generation (default: 5)
  --help                Show this help message
`);
      return 0;
    }
  }

  const config = new Config();
  const client = new ImageGenerationClient(config);

  const prompts = options.prompt
    ? Array(options.count).fill(options.prompt)
    : pickPrompts(options.count);

  const urls: string[] = [];

  for (let idx = 0; idx < prompts.length; idx++) {
    const prompt = prompts[idx];
    console.log(`[${idx + 1}/${prompts.length}] ${prompt}`);

    try {
      const response = await client.generate({
        prompt,
        size: options.size,
        sequentialImageGeneration: options.sequential ? "auto" : "disabled",
        sequentialImageGenerationMaxImages: options.maxSequential,
      });

      const helper = client.getResponseHelper(response);

      if (!helper.success) {
        console.error(`  Error: ${helper.errorMessages.join(", ")}`);
        continue;
      }

      for (const url of helper.imageUrls) {
        urls.push(url);
        console.log(`  ${url}`);
      }
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return 0;
}

main().then((code) => process.exit(code));
