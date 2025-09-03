import { RequestHandler } from "express";
import { z } from "zod";

const wooConfigSchema = z.object({
  baseUrl: z.string().url(),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
});

import { loadWooConfig, saveWooConfig as persistWooConfig } from "../db/sqlite";

export const saveWooConfigHandler: RequestHandler = async (req, res) => {
  try {
    const parsed = wooConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid WooCommerce configuration",
        issues: parsed.error.flatten(),
      });
    }

    persistWooConfig(parsed.data);

    res.json({
      success: true,
      message: "WooCommerce configuration saved successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save WooCommerce configuration",
    });
  }
};

export const getWooConfigHandler: RequestHandler = async (req, res) => {
  const wooConfig = loadWooConfig();
  if (!wooConfig) {
    return res.status(404).json({
      success: false,
      message: "WooCommerce configuration not found. Please configure in Settings > WooCommerce.",
    });
  }

  res.json({
    success: true,
    config: wooConfig,
  });
};

export const testWooConfigHandler: RequestHandler = async (req, res) => {
  const wooConfig = loadWooConfig();
  if (!wooConfig) {
    return res.status(400).json({
      success: false,
      message: "WooCommerce configuration not found. Please configure first.",
    });
  }

  try {
    const url = new URL("/wp-json/wc/v3/orders", wooConfig.baseUrl);
    url.searchParams.set("consumer_key", wooConfig.consumerKey);
    url.searchParams.set("consumer_secret", wooConfig.consumerSecret);
    url.searchParams.set("per_page", "1");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    res.json({
      success: true,
      message: "WooCommerce connection test successful",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "WooCommerce connection test failed",
    });
  }
};

// Export the config for use in other routes
export const getWooConfig = () => loadWooConfig();
