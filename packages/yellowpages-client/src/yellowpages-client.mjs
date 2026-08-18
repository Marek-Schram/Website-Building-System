#!/usr/bin/env node
// Yellowpages API Client for Business Discovery
// Enhanced lead finder with technology aversion detection

import axios from 'axios';
import { load } from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class YellowpagesClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.YELLOWPAGES_API_KEY || 'demo';
    this.baseUrl = 'https://api.yellowpages.com';
    this.timeout = options.timeout || 30000;
    this.maxResults = options.maxResults || 50;
    this.technologyAversionConfig = this.loadTechnologyAversionConfig();
  }

  loadTechnologyAversionConfig() {
    const configPath = path.join(__dirname, '../../config/tech-aversion-indicators.json');
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.warn('Could not load tech aversion config, using defaults');
      return this.getDefaultTechAversionConfig();
    }
  }

  getDefaultTechAversionConfig() {
    return {
      lowTechIndicators: [
        'no website', 'outdated website', 'basic html only', 'no online presence',
        'static html only', 'no digital presence', 'offline business'
      ],
      techStackIndicators: {
        outdatedFrameworks: ['jquery 1.12', 'bootstrap 3', 'php 5.6', 'wordpress 4.x'],
        missingTechnologies: ['responsive design', 'mobile app', 'api integration', 'cms'],
        poorPerformance: ['slow loading', 'no caching', 'poor seo', 'no analytics']
      },
      businessTypeIndicators: [
        'local shop', 'family business', 'traditional business', 'offline business',
        'brick and mortar', 'small business', 'mom and pop'
      ],
      scoring: {
        noWebsite: 40,
        outdatedTech: 30,
        noDigitalPresence: 35,
        oldDomain: 25,
        poorPerformance: 20,
        traditionalBusiness: 15
      }
    };
  }

  async searchBusinesses(query, location, options = {}) {
    try {
      const searchParams = new URLSearchParams({
        'q': `${query} ${location}`, 
        'limit': Math.min(options.limit || this.maxResults, 100).toString(),
        'offset': options.offset?.toString() || '0'
      });

      const response = await axios.get(
        `${this.baseUrl}/search?${searchParams.toString()}`, 
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return response.data.results || [];
    } catch (error) {
      console.error('Yellowpages API error:', error.message);
      throw error;
    }
  }

  async getBusinessDetails(businessId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/business/${businessId}`, 
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );
      return response.data;
    } catch (error) {
      console.error('Yellowpages business details error:', error.message);
      return null;
    }
  }

  detectTechnologyAversion(business) {
    const indicators = [];
    let techAversionScore = 0;

    // Website analysis
    if (business.website) {
      const websiteAnalysis = this.analyzeWebsite(business.website);
      indicators.push(...websiteAnalysis.indicators);
      techAversionScore += websiteAnalysis.score;
    } else {
      indicators.push('No website');
      techAversionScore += this.technologyAversionConfig.scoring.noWebsite;
    }

    // Business characteristics
    if (business.businessType) {
      const typeAnalysis = this.analyzeBusinessType(business.businessType);
      indicators.push(...typeAnalysis.indicators);
      techAversionScore += typeAnalysis.score;
    }

    // Technology stack analysis (if available)
    if (business.technologyStack) {
      const techAnalysis = this.analyzeTechStack(business.technologyStack);
      indicators.push(...techAnalysis.indicators);
      techAversionScore += techAnalysis.score;
    }

    // Digital presence indicators
    const digitalAnalysis = this.analyzeDigitalPresence(business);
    indicators.push(...digitalAnalysis.indicators);
    techAversionScore += digitalAnalysis.score;

    const finalScore = Math.min(techAversionScore, 100);
    const isTechAverse = finalScore >= 40; // Threshold for tech aversion

    return {
      isTechAverse,
      techAversionScore: finalScore,
      indicators,
      priority: this.determinePriority(finalScore)
    };
  }

  analyzeWebsite(websiteUrl) {
    const indicators = [];
    let score = 0;

    try {
      const domain = new URL(websiteUrl);
      const domainAge = this.estimateDomainAge(domain.hostname);

      if (domainAge < 2) {
        indicators.push('Very new website (< 2 years)');
        score += 10;
      } else if (domainAge < 5) {
        indicators.push('Recent website (< 5 years)');
        score += 20;
      } else {
        indicators.push('Established website');
      }

      if (!websiteUrl.includes('https://')) {
        indicators.push('No HTTPS encryption');
        score += 25;
      }

      // Check for modern tech stack
      if (!this.hasModernTechStack(websiteUrl)) {
        indicators.push('Outdated technology stack');
        score += 30;
      }

      // Check page load performance
      if (this.isSlowLoading(websiteUrl)) {
        indicators.push('Slow page loading');
        score += 20;
      }

    } catch (error) {
      indicators.push('Invalid website URL');
      score += 35;
    }

    return { indicators, score };
  }

  analyzeBusinessType(businessType) {
    const indicators = [];
    let score = 0;

    const lowerType = businessType.toLowerCase();
    for (const indicator of this.technologyAversionConfig.businessTypeIndicators) {
      if (lowerType.includes(indicator.toLowerCase())) {
        indicators.push(`Business type: ${businessType}`);
        score += 15;
        break;
      }
    }

    return { indicators, score };
  }

  analyzeTechStack(techStack) {
    const indicators = [];
    let score = 0;

    for (const outdated of this.technologyAversionConfig.techStackIndicators.outdatedFrameworks) {
      if (techStack.toLowerCase().includes(outdated.toLowerCase())) {
        indicators.push(`Outdated tech: ${outdated}`);
        score += 25;
        break;
      }
    }

    for (const missing of this.technologyAversionConfig.techStackIndicators.missingTechnologies) {
      // Simulated check - in reality this would require actual tech stack analysis
      if (Math.random() < 0.3) { // 30% chance for demo
        indicators.push(`Missing modern tech: ${missing}`);
        score += 15;
      }
    }

    return { indicators, score };
  }

  analyzeDigitalPresence(business) {
    const indicators = [];
    let score = 0;

    const hasSocialMedia = business.socialMediaProfiles && business.socialMediaProfiles.length > 0;
    const hasBlog = business.hasBlog || false;
    const hasOnlineOrdering = business.hasOnlineOrdering || false;
    const hasMobileApp = business.hasMobileApp || false;

    if (!hasSocialMedia) {
      indicators.push('No social media presence');
      score += 15;
    }

    if (!hasBlog) {
      indicators.push('No blog or content marketing');
      score += 10;
    }

    if (!hasOnlineOrdering && business.businessType?.toLowerCase().includes('ecommerce')) {
      indicators.push('E-commerce without online ordering');
      score += 20;
    }

    if (!hasMobileApp) {
      indicators.push('No mobile app');
      score += 10;
    }

    return { indicators, score };
  }

  estimateDomainAge(domain) {
    // In production, this would use WHOIS or domain age APIs
    // For demo, return random age between 0-10 years
    return Math.floor(Math.random() * 11);
  }

  hasModernTechStack(websiteUrl) {
    // In production, this would analyze actual website tech stack
    // For demo, return random true/false
    return Math.random() > 0.5;
  }

  isSlowLoading(websiteUrl) {
    // In production, this would use PageSpeed Insights API
    // For demo, return random true/false
    return Math.random() < 0.4; // 40% chance for demo
  }

  determinePriority(score) {
    if (score >= 70) return 'URGENT';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  async enhancedSearch(niche, location, options = {}) {
    const yellowpagesResults = await this.searchBusinesses(niche, location, options);
    const enhancedLeads = [];

    for (const business of yellowpagesResults) {
      const techAnalysis = this.detectTechnologyAversion(business);

      const lead = {
        source: 'yellowpages',
        name: business.name || '',
        phone: business.phone || '',
        address: business.location?.formattedAddress || '',
        website: business.website || '',
        businessType: business.businessType || '',
        rating: business.rating || null,
        reviews: business.reviews || 0,
        techAversion: techAnalysis.isTechAverse,
        techAversionScore: techAnalysis.techAversionScore,
        techAversionPriority: techAnalysis.priority,
        techIndicators: techAnalysis.indicators,
        discoveryMethod: 'yellowpages_api',
        dataQuality: business.dataQuality || 'high'
      };

      enhancedLeads.push(lead);
    }

    return enhancedLeads.sort((a, b) => {
      // Prioritize tech-aversive businesses with higher scores
      if (a.techAversion && !b.techAversion) return -1;
      if (!a.techAversion && b.techAversion) return 1;
      return b.techAversionScore - a.techAversionScore;
    });
  }
}

export default YellowpagesClient;
export { YellowpagesClient };
