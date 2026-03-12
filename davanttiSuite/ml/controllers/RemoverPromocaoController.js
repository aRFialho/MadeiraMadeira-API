const PromocaoService = require('../services/removerPromocaoService');

// Variável global para processamentos
let processamentosRemocao = {};

class PromocaoController {
  static async removerPromocaoUnica(req, res) {
    try {
      const { mlb_id } = req.body;
      
      if (!mlb_id) {
        return res.status(400).json({
          success: false,
          error: 'MLB ID é obrigatório'
        });
      }

      console.log(`🎯 Iniciando remoção de promoção para: ${mlb_id}`);
      const resultado = await PromocaoService.removerPromocaoUnico(mlb_id, {
        mlCreds: res.locals?.mlCreds || {},
        accountKey: res.locals?.accountKey || null,
        logger: console
      });
      
      res.json(resultado);

    } catch (error) {
      console.error('❌ Erro no endpoint de remoção:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async removerPromocoesLote(req, res) {
    try {
      const { mlb_ids, delay_entre_remocoes = 3000 } = req.body;
      
      if (!mlb_ids || !Array.isArray(mlb_ids) || mlb_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Lista de MLB IDs é obrigatória'
        });
      }

      const processId = Date.now().toString();
      
      // Inicializar status do processamento
      processamentosRemocao[processId] = {
        id: processId,
        status: 'iniciando',
        total_anuncios: mlb_ids.length,
        processados: 0,
        sucessos: 0,
        erros: 0,
        progresso: 0,
        iniciado_em: new Date(),
        resultados: []
      };

      // Responder imediatamente com o ID do processo
      res.json({
        success: true,
        message: 'Processamento iniciado',
        process_id: processId,
        total_anuncios: mlb_ids.length
      });

      // Processar em background (passando credenciais da conta atual)
      PromocaoService.processarRemocaoLote(
        processId,
        mlb_ids,
        delay_entre_remocoes,
        processamentosRemocao,
        {
          mlCreds: res.locals?.mlCreds || {},
          accountKey: res.locals?.accountKey || null,
          logger: console
        }
      );

    } catch (error) {
      console.error('❌ Erro no endpoint de lote:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async obterStatusRemocao(req, res) {
    const status = processamentosRemocao[req.params.id];
    if (!status) {
      return res.status(404).json({ error: 'Processamento não encontrado' });
    }
    res.json(status);
  }

  static getProcessamentosRemocao() {
    return processamentosRemocao;
  }

  static limparProcessamentosAntigos() {
    const agora = new Date();
    const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    Object.keys(processamentosRemocao).forEach(processId => {
      const processo = processamentosRemocao[processId];
      if (new Date(processo.iniciado_em) < umDiaAtras) {
        delete processamentosRemocao[processId];
      }
    });
  }
}

module.exports = PromocaoController;
