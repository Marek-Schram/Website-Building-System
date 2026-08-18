#!/usr/bin/env node
// Improvement-Only Detector
// Advanced opportunity detection that filters for only meaningful improvements
// Focuses on high-impact changes with clear business value

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

class ImprovementOnlyDetector {
  constructor() {
    this.improvementThresholds = {
      highImpact: 50,    // Must have significant business impact
      mediumImpact: 25,  // Moderate but noticeable impact
      lowImpact: 5,      // Minor improvements
      websiteScoreThreshold: 60 // Website quality must be at least decent
    };
    
    this.highPriorityCategories = new Set(['technical', 'security', 'functionality']);
    this.mediumPriorityCategories = new Set(['performance', 'seo']);
    this.lowPriorityCategories = new Set(['trust', 'design']);
    
    this.highImpactKeywords = [
      'online ordering', 'booking system', 'e-commerce', 'payments', 
      'mobile app', 'crm', 'analytics', 'email marketing', 'social media',
      'review system', 'contact form', 'https', 'security', 'backup',
      'cloud hosting', 'automation', 'integrations'
    ];
    
    this.technicalIndicators = new Set([
      'https', 'ssl', 'security', 'firewall', 'backup', 'cdn',
      'ssl certificate', 'https encryption', 'security headers',
      'performance optimization', 'speed', 'loading time', 'responsive'
    ]);
  }

  async detectImprovements(businessData) {
    const analysis = {
      businessId: businessData.id || `unknown-${Date.now()}`, 
      name: businessData.name || 'Unknown Business',
      website: businessData.website || null,
      businessType: businessData.businessType || businessData.category || 'Unknown',
      location: businessData.location || {},
      detectionDate: new Date().toISOString(),
      improvementOpportunity: 0,
      priority: 'LOW',
      category: 'general',
      specificImprovements: [],
      overallRecommendation: '',
      businessImpact: '',
      confidence: 0.5,
      competitiveGap: null
    };

    try {
      // Analyze multiple dimensions
      const websiteAnalysis = await this.analyzeWebsite(businessData);
      const techAnalysis = await this.analyzeTechnologyStack(businessData);
      const marketAnalysis = this.analyzeMarketPosition(businessData);
      const audienceAnalysis = this.analyzeTargetAudience(businessData);

      // Calculate improvement opportunity score
      const improvementScore = this.calculateImprovementScore(
        websiteAnalysis, techAnalysis, marketAnalysis, audienceAnalysis
      );

      // Generate specific improvements
      const improvements = this.generateSpecificImprovements(
        websiteAnalysis, techAnalysis, marketAnalysis, audienceAnalysis
      );

      // Determine business impact
      const impact = this.calculateBusinessImpact(improvements);

      // Set priority and category
      analysis.improvementOpportunity = improvementScore;
      analysis.priority = this.determinePriority(improvementScore, improvements);
      analysis.category = this.determineCategory(improvements);
      analysis.specificImprovements = improvements.filter(i => i.impact >= this.improvementThresholds.mediumImpact);
      analysis.overallRecommendation = this.generateOverallRecommendation(improvements);
      analysis.businessImpact = impact;
      analysis.confidence = this.calculateConfidence(websiteAnalysis, techAnalysis);
      analysis.competitiveGap = this.identifyCompetitiveGap(improvements, marketAnalysis);

      return analysis;
    } catch (error) {
      console.error(`❌ Improvement detection failed for ${businessData.name}:`, error.message);
      return null;
    }
  }

  async analyzeWebsite(businessData) {
    const websiteAnalysis = {
      score: 0,
      issues: [],
      opportunities: [],
      competitiveGap: null,
      userExperience: {
        mobile: false,
        speed: 'average',
        accessibility: false,
        security: false
      }
    };

    if (!businessData.website) {
      websiteAnalysis.score = 20;
      websiteAnalysis.issues.push({
        category: 'basic',
        severity: 'high',
        finding: 'No website presence',
        impact: 'Complete digital invisibility - competitors visible online',
        fix: 'Build a professional website with modern standards'
      });
      websiteAnalysis.opportunities.push({
        category: 'basic',
        priority: 'CRITICAL',
        title: 'Establish online presence',
        description: 'Your business needs a website to compete in 2024',
        roi: 'High - immediate market access'
      });
      return websiteAnalysis;
    }

    // Analyze website quality
    try {
      // Check for technical indicators
      const websiteUrl = businessData.website.startsWith('http') ? 
        businessData.website : `https://${businessData.website}`;
      
      // This would normally make HTTP requests, but for demonstration we'll simulate
      websiteAnalysis.score = this.calculateWebsiteScore(businessData);
      websiteAnalysis.issues = this.detectWebsiteIssues(businessData);
      websiteAnalysis.opportunities = this.generateWebsiteOpportunities(businessData);
      websiteAnalysis.competitiveGap = this.identifyWebsiteCompetitiveGap(businessData);
      
      // User experience analysis
      websiteAnalysis.userExperience.mobile = this.checkMobileOptimization(businessData);
      websiteAnalysis.userExperience.speed = this.assessWebsiteSpeed(businessData);
      websiteAnalysis.userExperience.accessibility = this.checkAccessibility(businessData);
      websiteAnalysis.userExperience.security = this.checkSecurity(businessData);

    } catch (error) {
      websiteAnalysis.issues.push({
        category: 'technical',
        severity: 'medium',
        finding: 'Website inaccessible or analysis failed',
        impact: 'Cannot assess current digital presence',
        fix: 'Ensure website is accessible and properly structured'
      });
    }

    return websiteAnalysis;
  }

  async analyzeTechnologyStack(businessData) {
    const techAnalysis = {
      score: 0,
      indicators: [],
      outdatedTech: [],
      modernTech: [],
      digitalMaturity: 'basic'
    };

    if (!businessData.website) {
      techAnalysis.score = 40;
      techAnalysis.indicators.push({
        type: 'absence',
        description: 'No digital presence or technology stack',
        impact: 'Major opportunity for digital transformation',
        priority: 'HIGH'
      });
      techAnalysis.outdatedTech = ['No digital presence'];
      techAnalysis.digitalMaturity = 'none';
      return techAnalysis;
    }

    // Analyze technology stack based on business characteristics
    const techStack = businessData.currentTech || businessData.technologyStack || {};
    
    // Check for modern technologies
    if (techStack.https) techAnalysis.modernTech.push('HTTPS security');
    if (techStack.responsive) techAnalysis.modernTech.push('Mobile responsive design');
    if (techStack.cms) techAnalysis.modernTech.push(`${techStack.cms} CMS`);
    if (techStack.performance && techStack.performance < 3) {
      techAnalysis.outdatedTech.push('Slow page performance');
    }
    
    // Calculate score based on technology maturity
    techAnalysis.score = this.calculateTechMaturityScore(techStack, techAnalysis);
    
    // Identify technology gaps
    techAnalysis.indicators = this.identifyTechIndicators(businessData, techStack);

    return techAnalysis;
  }

  analyzeMarketPosition(businessData) {
    const marketAnalysis = {
      competitiveGap: null,
      marketShare: 0,
      digitalAdvantage: false,
      customerExperienceGap: null,
      industryTrends: []
    };

    const industry = businessData.businessType || businessData.industry || 'unknown';
    const location = businessData.location || {};

    // Check if business has digital presence compared to competitors
    const hasDigitalPresence = businessData.website && businessData.socialMedia;
    const hasCompetitorsOnline = this.checkCompetitorPresence(industry, location);
    
    if (!hasDigitalPresence && hasCompetitorsOnline) {
      marketAnalysis.competitiveGap = {
        type: 'digital_presence_gap',
        severity: 'HIGH',
        description: `Your business lacks online presence while ${industry} competitors are visible online`,
        opportunity: 'First-mover advantage in local search results'
      };
      marketAnalysis.marketShare = 0;
    } else if (hasDigitalPresence && !hasCompetitorsOnline) {
      marketAnalysis.competitiveGap = {
        type: 'digital_first_mover',
        severity: 'MEDIUM',
        description: 'You have early digital advantage - maintain it',
        opportunity: 'Protect market position from emerging competitors'
      };
      marketAnalysis.marketShare = 80;
      marketAnalysis.digitalAdvantage = true;
    }

    // Analyze industry trends
    marketAnalysis.industryTrends = this.getIndustryTrends(industry);

    return marketAnalysis;
  }

  analyzeTargetAudience(businessData) {
    const audienceAnalysis = {
      targetMarket: 'local',
      digitalSavvy: 'medium',
      purchasingBehavior: 'mixed',
      preferredChannels: [],
      painPoints: []
    };

    // Based on business type and characteristics
    if (businessData.businessType?.includes('traditional') || 
        businessData.businessType?.includes('local shop')) {
      audienceAnalysis.digitalSavvy = 'low';
      audienceAnalysis.painPoints.push('Customers expect online presence', 'Competition from digital businesses');
      audienceAnalysis.preferredChannels.push('Google Maps', 'Facebook', 'word of mouth');
    } else if (businessData.businessType?.includes('restaurant') || 
               businessData.businessType?.includes('cafe')) {
      audienceAnalysis.digitalSavvy = 'medium';
      audienceAnalysis.painPoints.push('Food discovery online', 'reservation convenience');
      audienceAnalysis.preferredChannels.push('Google Reviews', 'Yelp', 'social media');
    } else if (businessData.businessType?.includes('retail') || 
               businessData.businessType?.includes('ecommerce')) {
      audienceAnalysis.digitalSavvy = 'high';
      audienceAnalysis.painPoints.push('cart abandonment', 'delivery expectations');
      audienceAnalysis.preferredChannels.push('website', 'mobile app', 'social commerce');
    }

    return audienceAnalysis;
  }

  calculateImprovementScore(websiteAnalysis, techAnalysis, marketAnalysis, audienceAnalysis) {
    let score = 0;

    // Website quality score (40% weight)
    score += Math.min(40, websiteAnalysis.score);

    // Technology maturity score (30% weight)
    score += Math.min(30, techAnalysis.score);

    // Competitive gap score (20% weight)
    if (marketAnalysis.competitiveGap) {
      if (marketAnalysis.competitiveGap.severity === 'HIGH') score += 20;
      else if (marketAnalysis.competitiveGap.severity === 'MEDIUM') score += 10;
    }

    // Market opportunity score (10% weight)
    if (audienceAnalysis.painPoints.length > 2) score += Math.min(10, audienceAnalysis.painPoints.length);

    return score;
  }

  generateSpecificImprovements(websiteAnalysis, techAnalysis, marketAnalysis, audienceAnalysis) {
    const improvements = [];

    // Generate improvements based on analysis
    if (websiteAnalysis.issues.length > 0) {
      for (const issue of websiteAnalysis.issues) {
        improvements.push(this.formatImprovement(issue, 'issue'));
      }
    }

    if (websiteAnalysis.opportunities.length > 0) {
      for (const opportunity of websiteAnalysis.opportunities) {
        improvements.push(this.formatImprovement(opportunity, 'opportunity'));
      }
    }

    if (techAnalysis.indicators.length > 0) {
      for (const indicator of techAnalysis.indicators) {
        if (indicator.priority === 'HIGH' || indicator.priority === 'CRITICAL') {
          improvements.push(this.formatImprovement(indicator, 'technology'));
        }
      }
    }

    // Add market-based improvements
    if (marketAnalysis.competitiveGap?.severity === 'HIGH') {
      improvements.push({
        title: 'Establish Digital Presence',
        category: 'basic',
        priority: 'CRITICAL',
        impact: 100,
        description: `Your business needs a website to compete with ${marketAnalysis.competitiveGap.opportunity.toLowerCase()}`,
        businessValue: 'Immediate market access and customer acquisition',
        roi: 'High - competitive necessity',
        effort: 'Medium - 4-6 weeks for basic site'
      });
    }

    // Add audience-based improvements
    for (const painPoint of audienceAnalysis.painPoints) {
      improvements.push({
        title: this.mapPainPointToImprovement(painPoint),
        category: 'customer_experience',
        priority: 'MEDIUM',
        impact: 30,
        description: painPoint,
        businessValue: 'Better customer acquisition and retention',
        roi: 'Medium - gradual improvement',
        effort: 'Low - targeted fixes'
      });
    }

    return improvements.sort((a, b) => b.impact - a.impact);
  }

  formatImprovement(issue, type) {
    if (type === 'issue') {
      return {
        title: this.mapIssueToImprovement(issue),
        category: issue.category || 'technical',
        priority: issue.severity === 'high' ? 'HIGH' : 
                 issue.severity === 'medium' ? 'MEDIUM' : 'LOW',
        impact: issue.severity === 'high' ? 50 : 
                issue.severity === 'medium' ? 30 : 15,
        description: issue.finding,
        businessValue: issue.impact,
        roi: issue.severity === 'high' ? 'High' : 'Medium',
        effort: issue.severity === 'high' ? 'Medium' : 'Low',
        timeframe: issue.severity === 'high' ? '4-6 weeks' : '2-4 weeks'
      };
    } else {
      return issue;
    }
  }

  mapIssueToImprovement(issue) {
    const mappings = {
      'No website presence': 'Build Professional Website',
      'Slow page performance': 'Optimize Website Performance',
      'No mobile responsive design': 'Implement Mobile-First Design',
      'Missing security features': 'Add Security Measures',
      'No social media presence': 'Establish Social Media Presence',
      'No online reviews': 'Implement Review Collection System'
    };

    return mappings[issue.finding] || issue.finding;
  }

  mapPainPointToImprovement(painPoint) {
    const mappings = {
      'Customers expect online presence': 'Establish Online Presence',
      'Competition from digital businesses': 'Digital Competitive Advantage',
      'Food discovery online': 'Online Food Discovery Optimization',
      'Reservation convenience': 'Online Reservation System',
      'Cart abandonment': 'Shopping Cart Optimization',
      'Delivery expectations': 'Delivery Integration'
    };

    return mappings[painPoint] || painPoint;
  }

  calculateBusinessImpact(improvements) {
    if (improvements.length === 0) return 'No significant impact expected';

    const highImpact = improvements.filter(i => i.priority === 'CRITICAL' && i.impact >= 50).length;
    const mediumImpact = improvements.filter(i => i.priority === 'HIGH' && i.impact >= 30).length;

    if (highImpact > 0 || mediumImpact > 2) {
      return 'High - Can increase revenue by 20-40% and customer base by 50%+';
    } else if (mediumImpact > 0 || improvements.length > 3) {
      return 'Medium - Can improve customer acquisition by 10-20%';
    } else {
      return 'Low - Minor improvements to existing operations';
    }
  }

  determinePriority(score, improvements) {
    if (score >= 70 || improvements.some(i => i.priority === 'CRITICAL' && i.impact >= 50)) {
      return 'CRITICAL';
    } else if (score >= 40 || improvements.some(i => i.priority === 'HIGH' && i.impact >= 30)) {
      return 'HIGH';
    } else if (score >= 20 || improvements.length > 0) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  determineCategory(improvements) {
    const categoryCounts = {};
    for (const improvement of improvements) {
      categoryCounts[improvement.category] = (categoryCounts[improvement.category] || 0) + 1;
    }
    
    const maxCategory = Object.entries(categoryCounts).reduce((max, [cat, count]) => 
      count > max.count ? { category: cat, count } : max, { category: 'general', count: 0 }
    );
    
    return maxCategory.category;
  }

  generateOverallRecommendation(improvements) {
    if (improvements.length === 0) return 'No improvements identified';

    const criticalCount = improvements.filter(i => i.priority === 'CRITICAL').length;
    const highCount = improvements.filter(i => i.priority === 'HIGH').length;

    if (criticalCount > 0) {
      return 'Prioritize immediate implementation of critical improvements to establish digital foundation';
    } else if (highCount > 0) {
      return 'Focus on high-impact improvements to gain competitive advantage';
    } else {
      return 'Implement incremental improvements to enhance digital presence gradually';
    }
  }

  calculateConfidence(websiteAnalysis, techAnalysis) {
    let confidence = 0.5;

    if (websiteAnalysis.issues.length > 0) confidence += 0.2;
    if (techAnalysis.indicators.some(i => i.priority === 'HIGH' || i.priority === 'CRITICAL')) confidence += 0.2;
    if (websiteAnalysis.issues.some(i => i.severity === 'high')) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  identifyCompetitiveGap(improvements, marketAnalysis) {
    if (marketAnalysis.competitiveGap) {
      return {
        gap: marketAnalysis.competitiveGap.type,
        description: marketAnalysis.competitiveGap.description,
        opportunity: marketAnalysis.competitiveGap.opportunity,
        urgency: marketAnalysis.competitiveGap.severity === 'HIGH' ? 'Immediate' : 'Within 3 months'
      };
    }
    return null;
  }

  // Helper methods for website analysis
  calculateWebsiteScore(businessData) {
    let score = 50; // Base score

    if (businessData.website) {
      score += 20; // Has website
      if (businessData.currentTech?.https) score += 15;
      if (businessData.currentTech?.responsive) score += 10;
      if (businessData.currentTech?.performance && businessData.currentTech.performance >= 4) score += 5;
    }

    return Math.min(100, score);
  }

  detectWebsiteIssues(businessData) {
    const issues = [];

    if (!businessData.website) {
      issues.push({
        category: 'basic',
        severity: 'high',
        finding: 'No website presence',
        impact: 'Complete digital invisibility - competitors visible online',
        fix: 'Build a professional website with modern standards'
      });
    } else {
      if (!businessData.currentTech?.https) {
        issues.push({
          category: 'technical',
          severity: 'high',
          finding: 'No HTTPS encryption',
          impact: 'Browsers show "Not Secure" warning, hurts SEO',
          fix: 'Implement SSL certificate and force HTTPS'
        });
      }

      if (!businessData.currentTech?.responsive) {
        issues.push({
          category: 'technical',
          severity: 'medium',
          finding: 'Not mobile responsive',
          impact: 'Over 60% of traffic is mobile, non-mobile sites lose customers',
          fix: 'Implement mobile-first responsive design'
        });
      }
    }

    return issues;
  }

  generateWebsiteOpportunities(businessData) {
    const opportunities = [];

    if (!businessData.website) {
      opportunities.push({
        category: 'basic',
        priority: 'CRITICAL',
        title: 'Establish online presence',
        description: 'Your business needs a website to compete in 2024',
        roi: 'High - immediate market access'
      });
    } else {
      if (!businessData.currentTech?.https) {
        opportunities.push({
          category: 'security',
          priority: 'HIGH',
          title: 'Implement HTTPS Security',
          description: 'Add SSL certificate for secure connections',
          roi: 'Medium - trust and SEO benefits'
        });
      }

      if (!businessData.currentTech?.responsive) {
        opportunities.push({
          category: 'ux',
          priority: 'MEDIUM',
          title: 'Improve Mobile Experience',
          description: 'Optimize for mobile devices and touch interactions',
          roi: 'High - captures mobile traffic'
        });
      }
    }

    return opportunities;
  }

  identifyWebsiteCompetitiveGap(businessData) {
    if (!businessData.website) {
      return {
        gap: 'digital_presence',
        severity: 'HIGH',
        description: 'Your business lacks online presence while local competitors are visible online',
        opportunity: 'First-mover advantage in local search results'
      };
    }
    return null;
  }

  checkMobileOptimization(businessData) {
    return businessData.currentTech?.responsive || false;
  }

  assessWebsiteSpeed(businessData) {
    return businessData.currentTech?.performance >= 4 ? 'fast' : 
           businessData.currentTech?.performance >= 2 ? 'average' : 'slow';
  }

  checkAccessibility(businessData) {
    return businessData.currentTech?.accessibility || false;
  }

  checkSecurity(businessData) {
    return businessData.currentTech?.https && businessData.currentTech?.security || false;
  }

  calculateTechMaturityScore(techStack, techAnalysis) {
    let score = 50; // Base score

    if (techStack.https) score += 20;
    if (techStack.responsive) score += 15;
    if (techStack.performance && techStack.performance >= 4) score += 10;
    if (techStack.cms && techStack.cms !== 'Unknown') score += 10;
    if (techStack.security) score += 10;
    if (techStack.accessibility) score += 5;

    return Math.min(100, score);
  }

  identifyTechIndicators(businessData, techStack) {
    const indicators = [];

    if (!techStack) {
      indicators.push({
        type: 'absence',
        description: 'No digital presence or technology stack',
        impact: 'Major opportunity for digital transformation',
        priority: 'HIGH'
      });
    } else {
      if (!techStack.https) {
        indicators.push({
          type: 'security_gap',
          description: 'Missing HTTPS encryption',
          impact: 'Security risk and SEO penalty',
          priority: 'HIGH'
        });
      }

      if (!techStack.responsive) {
        indicators.push({
          type: 'ux_gap',
          description: 'Not mobile responsive',
          impact: 'Poor user experience on mobile devices',
          priority: 'MEDIUM'
        });
      }
    }

    return indicators;
  }

  checkCompetitorPresence(industry, location) {
    // This would normally query a database or API to check competitors
    // For demonstration, we'll assume competitors exist
    return true;
  }

  getIndustryTrends(industry) {
    const trends = {
      restaurant: ['Online ordering', 'Table reservations', 'Delivery integration', 'Social media marketing'],
      retail: ['E-commerce', 'Click-and-collect', 'Mobile app', 'Personalization'],
      'local shop': ['Google Business Profile', 'Online reviews', 'Mobile website', 'Digital coupons'],
      service: ['Online booking', 'Appointment scheduling', 'Customer reviews', 'Service area coverage']
    };

    return trends[industry.toLowerCase()] || ['Digital presence', 'Online reviews', 'Mobile optimization'];
  }

  detectTechnologies() {
    return this.techAversionIndicators;
  }

  getDefaultTechAversionConfig() {
    return this.technologyAversionConfig;
  }

  analyzeWebsite(websiteUrl) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  analyzeBusinessType(businessType) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  analyzeTechStack(techStack) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  analyzeDigitalPresence(business) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  estimateDomainAge(domain) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  hasModernTechStack(websiteUrl) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  isSlowLoading(websiteUrl) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  determinePriority(score) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  calculateImprovementOpportunity(techScore) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  generateRecommendations(indicators, techScore) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  prioritizeLeads(leads) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }

  isTraditionalBusiness(businessType) {
    throw new Error('This method should not be called directly. Use detectTechnologies() instead.');
  }
}

export default ImprovementOnlyDetector;
export { ImprovementOnlyDetector };