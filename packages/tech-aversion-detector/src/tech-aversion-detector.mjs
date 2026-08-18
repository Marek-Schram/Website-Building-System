#!/usr/bin/env node
// Technology Aversion Detector
// Identifies businesses that are resistant to digital adoption and have high improvement potential

import axios from 'axios';
import { load } from 'cheerio';

class TechAversionDetector {
  constructor() {
    this.techAversionIndicators = {
      // Website-based indicators
      noWebsite: { weight: 40, description: 'No website presence' },
      outdatedCMS: { weight: 30, description: 'Uses outdated CMS (WordPress < 5.0, Joomla < 3.0)' },
      noSSL: { weight: 25, description: 'Missing HTTPS encryption' },
      slowPageSpeed: { weight: 20, description: 'Poor page load performance (> 5 seconds)' },
      noMobile: { weight: 15, description: 'No mobile-friendly design' },
      noBlog: { weight: 10, description: 'No blog or content marketing' },
      noSocialMedia: { weight: 10, description: 'No social media presence' },
      
      // Technology stack indicators
      oldTechStack: { weight: 35, description: 'Uses outdated technology stack' },
      noCRM: { weight: 25, description: 'No customer relationship management system' },
      noAnalytics: { weight: 15, description: 'No web analytics or tracking' },
      noEmailMarketing: { weight: 12, description: 'No email marketing automation' },
      noEcommerce: { weight: 30, description: 'E-commerce without proper features' },
      
      // Business characteristic indicators
      traditionalBusiness: { weight: 20, description: 'Traditional brick-and-mortar business' },
      familyBusiness: { weight: 15, description: 'Family-owned traditional business' },
      localOnly: { weight: 18, description: 'Local only, no online presence' },
      conservative: { weight: 12, description: 'Conservative approach to technology' },
      
      // Digital maturity indicators
      basicHTML: { weight: 30, description: 'Basic HTML only website' },
      staticSite: { weight: 25, description: 'Static HTML/CSS website' },
      noSEO: { weight: 20, description: 'No search engine optimization' },
      noContent: { weight: 15, description: 'No meaningful content or value proposition' },
      noContactForm: { weight: 10, description: 'No contact forms or inquiry system' }
    };

    this.techAversionThresholds = {
      highRisk: 60,  // Very technology averse, high opportunity
      mediumRisk: 30, // Somewhat technology averse, medium opportunity
      lowRisk: 10    // Minimal technology aversion, low opportunity
    };
  }

  async detectTechAversion(businessData) {
    const analysis = {
      businessId: businessData.id || `unknown-${Date.now()}`, 
      name: businessData.name || 'Unknown Business',
      website: businessData.website || null,
      businessType: businessData.businessType || businessData.category || 'Unknown',
      location: businessData.location || {},
      techScore: 0,
      riskLevel: 'LOW',
      indicators: [],
      recommendations: [],
      improvementOpportunity: 0
    };

    // Analyze website presence and quality
    if (!analysis.website) {
      analysis.indicators.push(this.techAversionIndicators.noWebsite);
      analysis.techScore += this.techAversionIndicators.noWebsite.weight;
    } else {
      const websiteAnalysis = await this.analyzeWebsite(analysis.website);
      analysis.indicators.push(...websiteAnalysis.indicators);
      analysis.techScore += websiteAnalysis.totalScore;
    }

    // Analyze business characteristics
    const businessAnalysis = this.analyzeBusinessCharacteristics(analysis.businessType);
    analysis.indicators.push(...businessAnalysis.indicators);
    analysis.techScore += businessAnalysis.totalScore;

    // Analyze digital presence
    const digitalAnalysis = await this.analyzeDigitalPresence(businessData);
    analysis.indicators.push(...digitalAnalysis.indicators);
    analysis.techScore += digitalAnalysis.totalScore;

    // Determine risk level
    analysis.riskLevel = this.determineRiskLevel(analysis.techScore);
    analysis.improvementOpportunity = this.calculateImprovementOpportunity(analysis.techScore);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.indicators, analysis.techScore);

    return analysis;
  }

  async analyzeWebsite(websiteUrl) {
    const indicators = [];
    let totalScore = 0;

    try {
      const response = await axios.get(websiteUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteWright-TechAnalyzer/1.0)'
        }
      });

      const html = response.data;
      const $ = load(html);

      // Check for HTTPS
      if (!websiteUrl.startsWith('https://')) {
        indicators.push(this.techAversionIndicators.noSSL);
        totalScore += this.techAversionIndicators.noSSL.weight;
      }

      // Check mobile responsiveness
      const viewportMeta = $('meta[name="viewport"]').length;
      if (viewportMeta === 0) {
        indicators.push(this.techAversionIndicators.noMobile);
        totalScore += this.techAversionIndicators.noMobile.weight;
      }

      // Check for blog or content management
      const hasBlog = $('article, .post, .blog, .entry-content').length > 0;
      if (!hasBlog) {
        indicators.push(this.techAversionIndicators.noBlog);
        totalScore += this.techAversionIndicators.noBlog.weight;
      }

      // Check social media links
      const socialLinks = $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="instagram.com"], a[href*="linkedin.com"]').length;
      if (socialLinks === 0) {
        indicators.push(this.techAversionIndicators.noSocialMedia);
        totalScore += this.techAversionIndicators.noSocialMedia.weight;
      }

      // Check for SSL certificate details
      const hasSSL = websiteUrl.startsWith('https://');
      if (!hasSSL) {
        indicators.push(this.techAversionIndicators.noSSL);
        totalScore += this.techAversionIndicators.noSSL.weight;
      }

      // Check page structure
      const hasContactForm = $('form, a[href*="contact"], .contact').length > 0;
      if (!hasContactForm) {
        indicators.push(this.techAversionIndicators.noContactForm);
        totalScore += this.techAversionIndicators.noContactForm.weight;
      }

      // Check for modern HTML5 features
      const hasHtml5 = $('html[lang]').length > 0;
      if (!hasHtml5) {
        indicators.push(this.techAversionIndicators.basicHTML);
        totalScore += this.techAversionIndicators.basicHTML.weight;
      }

    } catch (error) {
      indicators.push({ weight: 50, description: 'Website unreachable or invalid URL' });
      totalScore += 50;
    }

    return { indicators, totalScore };
  }

  analyzeBusinessCharacteristics(businessType) {
    const indicators = [];
    let totalScore = 0;
    const lowerType = businessType.toLowerCase();

    // Check for traditional business indicators
    const traditionalIndicators = [
      'local shop', 'family business', 'traditional', 'brick and mortar',
      'offline business', 'small business', 'mom and pop', 'neighborhood'
    ];

    for (const indicator of traditionalIndicators) {
      if (lowerType.includes(indicator)) {
        indicators.push({ weight: 20, description: `Traditional business: ${indicator}` });
        totalScore += 20;
        break;
      }
    }

    // Check for tech stack indicators
    const techStackIndicators = [
      'basic html', 'static website', 'simple site', 'custom website',
      ' handcrafted site'
    ];

    for (const indicator of techStackIndicators) {
      if (lowerType.includes(indicator) || lowerType.includes('website')) {
        indicators.push({ weight: 25, description: `Basic tech stack: ${indicator}` });
        totalScore += 25;
        break;
      }
    }

    return { indicators, totalScore };
  }

  async analyzeDigitalPresence(businessData) {
    const indicators = [];
    let totalScore = 0;

    // Check social media presence
    if (!businessData.socialMedia || Object.keys(businessData.socialMedia).length === 0) {
      indicators.push(this.techAversionIndicators.noSocialMedia);
      totalScore += this.techAversionIndicators.noSocialMedia.weight;
    }

    // Check for online review presence
    if (!businessData.hasOnlineReviews) {
      indicators.push({ weight: 15, description: 'No online reviews or ratings' });
      totalScore += 15;
    }

    // Check for booking or reservation system
    if (!businessData.hasBookingSystem) {
      indicators.push({ weight: 20, description: 'No online booking or reservation system' });
      totalScore += 20;
    }

    // Check for email newsletter subscription
    if (!businessData.emailMarketing) {
      indicators.push(this.techAversionIndicators.noEmailMarketing);
      totalScore += this.techAversionIndicators.noEmailMarketing.weight;
    }

    // Check for customer review system
    if (!businessData.reviewSystem) {
      indicators.push({ weight: 10, description: 'No customer review system' });
      totalScore += 10;
    }

    return { indicators, totalScore };
  }

  determineRiskLevel(techScore) {
    if (techScore >= this.techAversionThresholds.highRisk) return 'HIGH_RISK';
    if (techScore >= this.techAversionThresholds.mediumRisk) return 'MEDIUM_RISK';
    if (techScore >= this.techAversionThresholds.lowRisk) return 'LOW_RISK';
    return 'MINIMAL_RISK';
  }

  calculateImprovementOpportunity(techScore) {
    // Higher tech aversion = greater improvement opportunity
    return Math.min(techScore * 1.5, 100); // Scale opportunity to 100
  }

  generateRecommendations(indicators, techScore) {
    const recommendations = [];

    if (techScore >= this.techAversionThresholds.highRisk) {
      recommendations.push('Immediate website overhaul needed');
      recommendations.push('Implement full digital transformation strategy');
      recommendations.push('Consider automated marketing tools');
    } else if (techScore >= this.techAversionThresholds.mediumRisk) {
      recommendations.push('Basic website with contact forms');
      recommendations.push('Simple online presence setup');
      recommendations.push('Social media integration');
    } else {
      recommendations.push('Minor digital improvements');
      recommendations.push('Enhance existing online presence');
    }

    // Add specific recommendations based on indicators
    for (const indicator of indicators) {
      if (indicator.description.includes('HTTPS')) {
        recommendations.push('Implement SSL certificate');
      }
      if (indicator.description.includes('mobile')) {
        recommendations.push('Make website mobile-friendly');
      }
      if (indicator.description.includes('blog')) {
        recommendations.push('Add content marketing strategy');
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  prioritizeLeads(leads) {
    return leads.sort((a, b) => {
      // Priority 1: High tech aversion scores
      if (a.techScore !== b.techScore) {
        return b.techScore - a.techScore;
      }

      // Priority 2: Improvement opportunity
      if (a.improvementOpportunity !== b.improvementOpportunity) {
        return b.improvementOpportunity - a.improvementOpportunity;
      }

      // Priority 3: Business type (traditional businesses first)
      const aTraditional = this.isTraditionalBusiness(a.businessType) ? 100 : 0;
      const bTraditional = this.isTraditionalBusiness(b.businessType) ? 100 : 0;
      if (aTraditional !== bTraditional) {
        return bTraditional - aTraditional;
      }

      return 0;
    });
  }

  isTraditionalBusiness(businessType) {
    const traditionalKeywords = [
      'local shop', 'family business', 'traditional', 'brick and mortar',
      'offline business', 'small business', 'mom and pop'
    ];
    const lowerType = businessType.toLowerCase();
    return traditionalKeywords.some(keyword => lowerType.includes(keyword));
  }
}

export default TechAversionDetector;
export { TechAversionDetector };